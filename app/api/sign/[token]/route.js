import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import {
  signedUrl,
  genOtp,
  hashOtp,
  logEvent,
  requestMeta,
  finalizeIfComplete,
  originalPath,
} from "@/lib/documentsServer";
import { sendEmail } from "@/lib/email";
import { otpEmail, completionEmail, officerNudgeEmail, formatLagos } from "@/lib/documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PUBLIC route — no staff session. Secured entirely by the one-time sign_token
// in the path plus the emailed OTP. Clients never log in.

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_MS = 30 * 1000; // throttle re-sends
const OTP_MAX_ATTEMPTS = 5;

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://transworld-engagement.vercel.app";
}

async function loadByToken(supabase, token) {
  if (!token) return null;
  const { data: sig } = await supabase
    .from("signatories")
    .select("*")
    .eq("sign_token", token)
    .maybeSingle();
  if (!sig) return null;
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", sig.document_id)
    .maybeSingle();
  return doc ? { sig, doc } : null;
}

function tokenExpired(sig) {
  return sig.token_expires_at && new Date(sig.token_expires_at).getTime() < Date.now();
}

// GET /api/sign/:token — load the document for signing; mark viewed.
export async function GET(req, { params }) {
  const supabase = getSupabase();
  const found = await loadByToken(supabase, params.token);
  if (!found) return NextResponse.json({ error: "This signing link is not valid." }, { status: 404 });
  const { sig, doc } = found;

  if (doc.status === "voided")
    return NextResponse.json({ error: "This document has been withdrawn." }, { status: 410 });
  if (tokenExpired(sig) && sig.status !== "signed")
    return NextResponse.json({ error: "This signing link has expired. Please contact Transworld." }, { status: 410 });

  if (sig.status === "signed") {
    return NextResponse.json({
      state: "signed",
      document: { title: doc.title, status: doc.status },
      signer: { name: sig.name },
    });
  }

  // Mark viewed (first open) and log it.
  const meta = requestMeta(req);
  if (sig.status === "pending") {
    await supabase.from("signatories").update({ status: "viewed" }).eq("id", sig.id);
    await logEvent({
      document_id: doc.id,
      signatory_id: sig.id,
      event_type: "viewed",
      actor: sig.email,
      ip: meta.ip,
      user_agent: meta.user_agent,
    });
  }

  let viewUrl = null;
  try {
    viewUrl = await signedUrl(doc.storage_path || originalPath(doc.id), 600);
  } catch {
    /* viewer will show a fallback message */
  }

  return NextResponse.json({
    state: "ready",
    document: { title: doc.title, status: doc.status },
    signer: { name: sig.name, email: sig.email },
    viewUrl,
    requiresOtp: true,
    expiresLabel: formatLagos(sig.token_expires_at),
  });
}

// POST /api/sign/:token — { action: request-otp | verify-otp | submit | decline }
export async function POST(req, { params }) {
  const supabase = getSupabase();
  const found = await loadByToken(supabase, params.token);
  if (!found) return NextResponse.json({ error: "This signing link is not valid." }, { status: 404 });
  const { sig, doc } = found;
  const meta = requestMeta(req);

  if (doc.status === "voided")
    return NextResponse.json({ error: "This document has been withdrawn." }, { status: 410 });
  if (sig.status === "signed")
    return NextResponse.json({ error: "You have already signed this document." }, { status: 400 });
  if (tokenExpired(sig))
    return NextResponse.json({ error: "This signing link has expired." }, { status: 410 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const action = body.action;

  // ----- request a one-time code ------------------------------------------
  if (action === "request-otp") {
    if (sig.otp_sent_at && Date.now() - new Date(sig.otp_sent_at).getTime() < OTP_RESEND_MS) {
      return NextResponse.json({ error: "Please wait a moment before requesting another code." }, { status: 429 });
    }
    const code = genOtp();
    const { error } = await supabase
      .from("signatories")
      .update({
        otp_code_hash: hashOtp(code, params.token),
        otp_expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
        otp_sent_at: new Date().toISOString(),
        otp_attempts: 0,
      })
      .eq("id", sig.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { subject, html } = otpEmail({ signerName: sig.name, code, documentTitle: doc.title });
    const sent = await sendEmail({ to: sig.email, subject, html });
    if (!sent.ok) return NextResponse.json({ error: "Could not send the code: " + sent.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  // shared OTP check (used by verify-otp and submit)
  async function checkOtp(code) {
    const clean = String(code || "").trim();
    if (!clean) return { ok: false, error: "Enter the code we emailed you." };
    if (!sig.otp_code_hash || !sig.otp_expires_at) {
      return { ok: false, error: "Request a code first." };
    }
    if (new Date(sig.otp_expires_at).getTime() < Date.now()) {
      return { ok: false, error: "That code has expired — request a new one." };
    }
    if ((sig.otp_attempts || 0) >= OTP_MAX_ATTEMPTS) {
      return { ok: false, error: "Too many attempts. Request a new code." };
    }
    if (hashOtp(clean, params.token) !== sig.otp_code_hash) {
      await supabase
        .from("signatories")
        .update({ otp_attempts: (sig.otp_attempts || 0) + 1 })
        .eq("id", sig.id);
      return { ok: false, error: "That code is not correct." };
    }
    return { ok: true };
  }

  // ----- verify a code (no consumption) -----------------------------------
  if (action === "verify-otp") {
    const res = await checkOtp(body.otp);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // ----- decline -----------------------------------------------------------
  if (action === "decline") {
    await supabase.from("signatories").update({ status: "declined" }).eq("id", sig.id);
    await logEvent({
      document_id: doc.id,
      signatory_id: sig.id,
      event_type: "viewed",
      actor: sig.email,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { declined: true, reason: String(body.reason || "").slice(0, 200) },
    });
    return NextResponse.json({ ok: true, declined: true });
  }

  // ----- submit the signature ---------------------------------------------
  if (action === "submit") {
    const otp = await checkOtp(body.otp);
    if (!otp.ok) return NextResponse.json({ error: otp.error }, { status: 400 });

    const signatureType = body.signature_type === "typed" ? "typed" : "drawn";
    const signatureData = String(body.signature_data || "").trim();
    const consent = body.consent === true;
    if (!consent) return NextResponse.json({ error: "Please tick the consent box to sign." }, { status: 400 });
    if (!signatureData) return NextResponse.json({ error: "Please provide your signature." }, { status: 400 });

    const { error: upErr } = await supabase
      .from("signatories")
      .update({
        status: "signed",
        signature_type: signatureType,
        signature_data: signatureData,
        consent_given: true,
        signer_ip: meta.ip,
        signer_user_agent: meta.user_agent,
        signed_at: new Date().toISOString(),
        // consume the OTP
        otp_code_hash: null,
        otp_expires_at: null,
      })
      .eq("id", sig.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    await logEvent({
      document_id: doc.id,
      signatory_id: sig.id,
      event_type: "signed",
      actor: sig.email,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { signature_type: signatureType, verification: "otp" },
    });

    // Next state: countersignature pending, or finalize now.
    if (doc.requires_countersignature) {
      await supabase.from("documents").update({ status: "partially_signed" }).eq("id", doc.id);

      // nudge the officer (staff-facing, never the client) if we can reach them.
      const { data: officer } = await supabase
        .from("signatories")
        .select("name,email,app_user_id")
        .eq("document_id", doc.id)
        .eq("role", "officer")
        .maybeSingle();
      if (officer && officer.email) {
        const { subject, html } = officerNudgeEmail({
          officerName: officer.name,
          documentTitle: doc.title,
          appUrl: `${appUrl()}/documents/${doc.id}`,
        });
        await sendEmail({ to: officer.email, subject, html });
      }
      return NextResponse.json({ ok: true, completed: false, awaiting: "officer" });
    }

    // No countersignature → finalize immediately.
    let completed = false;
    let finalizeRes = null;
    try {
      finalizeRes = await finalizeIfComplete(doc.id);
      completed = finalizeRes.completed;
    } catch (e) {
      return NextResponse.json(
        { ok: true, completed: false, warning: "Signed, but finalizing failed: " + e.message },
        { status: 200 }
      );
    }
    if (completed) {
      const { subject, html } = completionEmail({ signerName: sig.name, documentTitle: doc.title });
      const attachments =
        finalizeRes && finalizeRes.signedBytes
          ? [
              {
                filename: finalizeRes.filename,
                content: Buffer.from(finalizeRes.signedBytes).toString("base64"),
              },
            ]
          : undefined;
      await sendEmail({ to: sig.email, subject, html, attachments });
    }
    return NextResponse.json({ ok: true, completed });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

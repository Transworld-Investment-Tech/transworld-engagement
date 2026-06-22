import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";
import { genToken, logEvent, requestMeta } from "@/lib/documentsServer";
import { sendEmail } from "@/lib/email";
import {
  signingRequestEmail,
  officerNudgeEmail,
  nextSignatory,
  formatLagos,
} from "@/lib/documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://transworld-engagement.vercel.app";
}

// POST /api/documents/:id/remind — manual reminder to the current pending
// signer. manager+. This is a deliberate human click — there is no reminder
// cron, so it never conflicts with "cron must never auto-send client-facing
// mail." Each reminder is logged.
export async function POST(req, { params }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data: document } = await supabase
    .from("documents")
    .select("id,title,status")
    .eq("id", params.id)
    .maybeSingle();
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!["sent", "partially_signed"].includes(document.status)) {
    return NextResponse.json(
      { error: "There is no one waiting to sign on this document" },
      { status: 400 }
    );
  }

  const { data: sigs } = await supabase
    .from("signatories")
    .select("*")
    .eq("document_id", params.id)
    .order("sign_order", { ascending: true });

  const target = nextSignatory(sigs || []);
  if (!target) {
    return NextResponse.json({ error: "Nobody is currently awaiting signature" }, { status: 400 });
  }
  const meta = requestMeta(req);

  // Officer's turn → staff nudge (in-app countersignature), never a client email.
  if (target.role === "officer") {
    const to = target.email || user.email;
    const { subject, html } = officerNudgeEmail({
      officerName: target.name,
      documentTitle: document.title,
      appUrl: `${appUrl()}/documents/${document.id}`,
    });
    const sent = await sendEmail({ to, subject, html });
    if (!sent.ok) return NextResponse.json({ error: "Email failed: " + sent.error }, { status: 502 });

    await logEvent({
      document_id: params.id,
      signatory_id: target.id,
      event_type: "sent",
      actor: user.email,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { reminder: true, to, audience: "officer" },
    });
    return NextResponse.json({ ok: true, reminded: "officer" });
  }

  // Client's turn → resend the signing link. Refresh the token if it has expired.
  let token = target.sign_token;
  const expired =
    !token ||
    (target.token_expires_at && new Date(target.token_expires_at).getTime() < Date.now());
  if (expired) {
    token = genToken();
    await supabase
      .from("signatories")
      .update({ sign_token: token, token_expires_at: document_expiry() })
      .eq("id", target.id);
  }

  const signUrl = `${appUrl()}/sign/${token}`;
  const { subject, html } = signingRequestEmail({
    signerName: target.name,
    documentTitle: document.title,
    signUrl,
    expiresLabel: formatLagos(target.token_expires_at),
  });
  const sent = await sendEmail({ to: target.email, subject, html });
  if (!sent.ok) return NextResponse.json({ error: "Email failed: " + sent.error }, { status: 502 });

  await logEvent({
    document_id: params.id,
    signatory_id: target.id,
    event_type: "sent",
    actor: user.email,
    ip: meta.ip,
    user_agent: meta.user_agent,
    metadata: { reminder: true, to: target.email, audience: "client" },
  });
  return NextResponse.json({ ok: true, reminded: "client" });
}

function document_expiry() {
  // 14 days from now if we had to regenerate (kept simple and aligned with default).
  return new Date(Date.now() + 14 * 86400000).toISOString();
}

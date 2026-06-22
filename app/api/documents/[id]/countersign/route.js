import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";
import { logEvent, requestMeta, finalizeIfComplete } from "@/lib/documentsServer";
import { sendEmail } from "@/lib/email";
import { completionEmail, nextSignatory } from "@/lib/documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/documents/:id/countersign — the executing officer signs in-app.
// Their logged-in session IS the second factor (Decision 2: officer in-app).
// The assigned officer signs; if none was assigned at creation, any manager+
// may countersign and their identity is recorded. Admin may always act.
export async function POST(req, { params }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const signatureType = body.signature_type === "typed" ? "typed" : "drawn";
  const signatureData = String(body.signature_data || "").trim();
  const consent = body.consent === true;
  if (!consent) return NextResponse.json({ error: "Consent is required to sign" }, { status: 400 });
  if (!signatureData) return NextResponse.json({ error: "Provide a signature" }, { status: 400 });

  const supabase = getSupabase();
  const { data: document } = await supabase
    .from("documents")
    .select("id,title,status,requires_countersignature")
    .eq("id", params.id)
    .maybeSingle();
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (["completed", "voided", "expired"].includes(document.status)) {
    return NextResponse.json({ error: `This document is ${document.status}` }, { status: 400 });
  }

  const { data: sigs } = await supabase
    .from("signatories")
    .select("*")
    .eq("document_id", params.id)
    .order("sign_order", { ascending: true });

  const officer = (sigs || []).find((s) => s.role === "officer");
  if (!officer) return NextResponse.json({ error: "This document has no officer signatory" }, { status: 400 });
  if (officer.status === "signed") {
    return NextResponse.json({ error: "The countersignature is already recorded" }, { status: 400 });
  }

  // Enforce signing order — the client must sign before the officer executes.
  const turn = nextSignatory(sigs || []);
  if (!turn || turn.id !== officer.id) {
    return NextResponse.json(
      { error: "The client has not signed yet — the officer signs second" },
      { status: 400 }
    );
  }

  // If a specific officer was assigned, only that officer (or an admin) may sign.
  if (officer.app_user_id && officer.app_user_id !== user.id && !hasRole(user, "admin")) {
    return NextResponse.json(
      { error: "This document is assigned to a different officer to countersign" },
      { status: 403 }
    );
  }

  const meta = requestMeta(req);
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
      // bind the countersignature to the acting staff account if unassigned
      app_user_id: officer.app_user_id || user.id,
      name: officer.app_user_id ? officer.name : user.name,
      email: officer.app_user_id ? officer.email : user.email,
    })
    .eq("id", officer.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await logEvent({
    document_id: params.id,
    signatory_id: officer.id,
    event_type: "countersigned",
    actor: user.email,
    ip: meta.ip,
    user_agent: meta.user_agent,
    metadata: { signature_type: signatureType },
  });

  // Finalize (all signed → assemble, hash, store, complete).
  let completed = false;
  try {
    const res = await finalizeIfComplete(params.id);
    completed = res.completed;
  } catch (e) {
    return NextResponse.json(
      { ok: true, warning: "Signed, but finalizing the PDF failed: " + e.message },
      { status: 200 }
    );
  }

  // Notify the client their document is fully executed.
  if (completed) {
    const client = (sigs || []).find((s) => s.role === "client");
    if (client && client.email) {
      const { subject, html } = completionEmail({ signerName: client.name, documentTitle: document.title });
      await sendEmail({ to: client.email, subject, html });
    }
  }

  return NextResponse.json({ ok: true, completed });
}

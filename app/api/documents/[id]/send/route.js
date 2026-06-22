import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";
import { genToken, logEvent, requestMeta } from "@/lib/documentsServer";
import { sendEmail } from "@/lib/email";
import { signingRequestEmail, formatLagos, DEFAULT_EXPIRY_DAYS } from "@/lib/documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://transworld-engagement.vercel.app";
}

// POST /api/documents/:id/send — issue the client's one-time link and email it.
// manager+. Moves the document draft → sent.
export async function POST(req, { params }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data: document } = await supabase
    .from("documents")
    .select("id,title,status,storage_path,expires_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!document.storage_path) {
    return NextResponse.json({ error: "The document has no uploaded file" }, { status: 400 });
  }
  if (!["draft", "sent"].includes(document.status)) {
    return NextResponse.json(
      { error: `A ${document.status} document cannot be sent` },
      { status: 400 }
    );
  }

  // Client signatory (order 1).
  const { data: client } = await supabase
    .from("signatories")
    .select("*")
    .eq("document_id", params.id)
    .eq("role", "client")
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "No client signatory on this document" }, { status: 400 });
  if (client.status === "signed") {
    return NextResponse.json({ error: "The client has already signed" }, { status: 400 });
  }

  // Fresh one-time token + expiry (align token expiry with the document window).
  const token = genToken();
  const tokenExpiresAt =
    document.expires_at ||
    new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 86400000).toISOString();

  const { error: upErr } = await supabase
    .from("signatories")
    .update({ sign_token: token, token_expires_at: tokenExpiresAt, status: "pending" })
    .eq("id", client.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const signUrl = `${appUrl()}/sign/${token}`;
  const { subject, html } = signingRequestEmail({
    signerName: client.name,
    documentTitle: document.title,
    signUrl,
    expiresLabel: formatLagos(tokenExpiresAt),
  });
  const sent = await sendEmail({ to: client.email, subject, html });
  if (!sent.ok) {
    return NextResponse.json({ error: "Email failed: " + sent.error }, { status: 502 });
  }

  if (document.status === "draft") {
    await supabase.from("documents").update({ status: "sent" }).eq("id", params.id);
  }

  const meta = requestMeta(req);
  await logEvent({
    document_id: params.id,
    signatory_id: client.id,
    event_type: "sent",
    actor: user.email,
    ip: meta.ip,
    user_agent: meta.user_agent,
    metadata: { to: client.email, resend_id: sent.id || null },
  });

  return NextResponse.json({ ok: true });
}

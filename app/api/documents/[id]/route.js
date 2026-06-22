import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";
import { logEvent, requestMeta, originalPath, signedPath, removeObjects } from "@/lib/documentsServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/documents/:id — full detail (any signed-in user can view).
export async function GET(_req, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const { data: signatories } = await supabase
    .from("signatories")
    .select(
      "id,role,sign_order,name,email,app_user_id,status,signature_type,consent_given,signer_ip,signed_at,token_expires_at"
    )
    .eq("document_id", params.id)
    .order("sign_order", { ascending: true });

  const { data: events } = await supabase
    .from("signature_events")
    .select("id,event_type,actor,ip,created_at,metadata")
    .eq("document_id", params.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    document,
    signatories: signatories || [],
    events: events || [],
  });
}

// PATCH /api/documents/:id — currently supports { action: "void" } (manager+).
export async function PATCH(req, { params }) {
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

  if (body.action !== "void") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: document } = await supabase
    .from("documents")
    .select("id,status")
    .eq("id", params.id)
    .maybeSingle();
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (document.status === "completed") {
    return NextResponse.json({ error: "A completed document cannot be voided" }, { status: 400 });
  }

  const { error } = await supabase
    .from("documents")
    .update({ status: "voided" })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = requestMeta(req);
  await logEvent({
    document_id: params.id,
    event_type: "voided",
    actor: user.email,
    ip: meta.ip,
    user_agent: meta.user_agent,
    metadata: { reason: (body.reason || "").slice(0, 200) },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/documents/:id — admin only. Removes storage objects too; the FK
// cascade clears signatories / fields / events.
export async function DELETE(_req, { params }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "admin")) {
    return NextResponse.json({ error: "Only an admin can delete a document" }, { status: 403 });
  }

  const supabase = getSupabase();
  await removeObjects([originalPath(params.id), signedPath(params.id)]);
  const { error } = await supabase.from("documents").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

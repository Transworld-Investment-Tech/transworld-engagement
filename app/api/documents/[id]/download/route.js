import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/session";
import { signedUrl, logEvent, requestMeta } from "@/lib/documentsServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/documents/:id/download — returns a short-lived signed URL to the
// final stamped PDF (or the original if not yet completed). Any signed-in user.
export async function GET(req, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data: document } = await supabase
    .from("documents")
    .select("id,status,storage_path,signed_storage_path")
    .eq("id", params.id)
    .maybeSingle();
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const path = document.signed_storage_path || document.storage_path;
  if (!path) return NextResponse.json({ error: "No file is available yet" }, { status: 404 });

  let url;
  try {
    url = await signedUrl(path, 600);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }

  const meta = requestMeta(req);
  await logEvent({
    document_id: params.id,
    event_type: "downloaded",
    actor: user.email,
    ip: meta.ip,
    user_agent: meta.user_agent,
    metadata: { which: document.signed_storage_path ? "signed" : "original" },
  });

  return NextResponse.json({ url, which: document.signed_storage_path ? "signed" : "original" });
}

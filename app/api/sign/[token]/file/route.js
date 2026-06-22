import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { downloadPdf, originalPath } from "@/lib/documentsServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PUBLIC, token-gated — GET /api/sign/:token/file
// Streams the original PDF bytes same-origin so the signer's in-browser pdf.js
// render has no cross-origin/CORS surface. Viewing (not signing) needs no OTP;
// signing itself is still gated by the emailed one-time code on POST.
export async function GET(_req, { params }) {
  const supabase = getSupabase();
  const token = params.token;
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: sig } = await supabase
    .from("signatories")
    .select("document_id,status,token_expires_at")
    .eq("sign_token", token)
    .maybeSingle();
  if (!sig) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });

  const { data: doc } = await supabase
    .from("documents")
    .select("id,status,storage_path")
    .eq("id", sig.document_id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.status === "voided")
    return NextResponse.json({ error: "This document has been withdrawn." }, { status: 410 });

  const expired =
    sig.token_expires_at && new Date(sig.token_expires_at).getTime() < Date.now();
  if (expired && sig.status !== "signed")
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });

  let bytes;
  try {
    bytes = await downloadPdf(doc.storage_path || originalPath(doc.id));
  } catch {
    return NextResponse.json({ error: "Could not load the document file." }, { status: 502 });
  }

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}

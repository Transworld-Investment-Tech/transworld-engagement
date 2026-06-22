import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";
import {
  uploadPdf,
  originalPath,
  sha256Hex,
  logEvent,
  requestMeta,
} from "@/lib/documentsServer";
import { DEFAULT_EXPIRY_DAYS } from "@/lib/documents";
import { sanitizeField } from "@/lib/pdfFields";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/documents — list (any signed-in user can view).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data: docs, error } = await supabase
    .from("documents")
    .select(
      "id,title,status,requires_countersignature,original_filename,created_at,completed_at,expires_at,contact_id"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach signatory progress + client name in one extra query each (small set).
  const ids = (docs || []).map((d) => d.id);
  let sigByDoc = new Map();
  if (ids.length) {
    const { data: sigs } = await supabase
      .from("signatories")
      .select("document_id,role,status,sign_order,name")
      .in("document_id", ids);
    (sigs || []).forEach((s) => {
      const list = sigByDoc.get(s.document_id) || [];
      list.push(s);
      sigByDoc.set(s.document_id, list);
    });
  }

  const documents = (docs || []).map((d) => {
    const sigs = sigByDoc.get(d.id) || [];
    const signed = sigs.filter((s) => s.status === "signed").length;
    const client = sigs.find((s) => s.role === "client");
    return {
      ...d,
      signatory_count: sigs.length,
      signed_count: signed,
      client_name: client ? client.name : null,
    };
  });

  return NextResponse.json({ documents });
}

// POST /api/documents — create a draft document from an uploaded PDF.
// multipart/form-data: file, title, contact_id, requires_countersignature,
// officer_user_id (optional), expires_in_days (optional).
export async function POST(req) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json(
      { error: "You do not have permission to create documents" },
      { status: 403 }
    );
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const file = form.get("file");
  const title = String(form.get("title") || "").trim();
  const contactId = String(form.get("contact_id") || "").trim();
  const kind = String(form.get("kind") || "signature") === "acceptance" ? "acceptance" : "signature";
  // Acceptance documents are client-only: no officer countersignature.
  const requiresCounter =
    kind === "acceptance"
      ? false
      : String(form.get("requires_countersignature") || "true") !== "false";
  const officerUserId =
    kind === "acceptance" ? null : String(form.get("officer_user_id") || "").trim() || null;
  const expiresInDays =
    parseInt(String(form.get("expires_in_days") || ""), 10) || DEFAULT_EXPIRY_DAYS;

  // Staff-placed fields (JSON). Sanitized; invalid entries are dropped.
  let placedFields = [];
  try {
    const raw = JSON.parse(String(form.get("fields") || "[]"));
    if (Array.isArray(raw)) placedFields = raw.map((f) => sanitizeField(f)).filter(Boolean);
  } catch {
    placedFields = [];
  }

  if (!title) return NextResponse.json({ error: "A document title is required" }, { status: 400 });
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Please attach a PDF file" }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "The file must be a PDF" }, { status: 400 });
  }
  if (!contactId) {
    return NextResponse.json({ error: "Choose the client who will sign" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Resolve the client contact.
  const { data: contact } = await supabase
    .from("contacts")
    .select("id,title,first_name,last_name,email")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Client contact not found" }, { status: 404 });
  if (!contact.email) {
    return NextResponse.json(
      { error: "That client has no email address — add one before sending a document." },
      { status: 400 }
    );
  }
  const clientName = [contact.title, contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  // Resolve the officer (optional at creation; if omitted, any manager+ can
  // countersign later and their identity is recorded then).
  let officer = null;
  if (requiresCounter && officerUserId) {
    const { data: o } = await supabase
      .from("app_users")
      .select("id,name,email")
      .eq("id", officerUserId)
      .maybeSingle();
    if (!o) return NextResponse.json({ error: "Selected officer not found" }, { status: 404 });
    officer = o;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const originalHash = sha256Hex(bytes);
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

  // 1) create the document row (draft) so we have its id for the storage path.
  const { data: doc, error: insErr } = await supabase
    .from("documents")
    .insert({
      title,
      original_filename: file.name || "document.pdf",
      status: "draft",
      contact_id: contact.id,
      requires_countersignature: requiresCounter,
      kind,
      created_by: user.id,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // 2) upload the original PDF and record its path.
  try {
    const path = originalPath(doc.id);
    await uploadPdf(path, bytes);
    await supabase.from("documents").update({ storage_path: path }).eq("id", doc.id);
  } catch (e) {
    await supabase.from("documents").delete().eq("id", doc.id); // roll back the row
    return NextResponse.json({ error: "Upload failed: " + e.message }, { status: 502 });
  }

  // 3) signatories — client at order 1, officer (if any) at order 2.
  const rows = [
    {
      document_id: doc.id,
      role: "client",
      sign_order: 1,
      name: clientName,
      email: contact.email,
      contact_id: contact.id,
      status: "pending",
    },
  ];
  if (requiresCounter) {
    rows.push({
      document_id: doc.id,
      role: "officer",
      sign_order: 2,
      name: officer ? officer.name : "TISL officer (to be assigned)",
      email: officer ? officer.email : (user.email || "officer@transworldltd.com.ng"),
      app_user_id: officer ? officer.id : null,
      status: "pending",
    });
  }
  const { error: sigErr } = await supabase.from("signatories").insert(rows);
  if (sigErr) return NextResponse.json({ error: sigErr.message }, { status: 500 });

  // 3b) placed fields (if any) — the field registry the client fills in-document.
  if (placedFields.length) {
    const { error: fErr } = await supabase
      .from("signature_fields")
      .insert(placedFields.map((f) => ({ document_id: doc.id, signatory_role: f.role, field_type: f.field_type, label: f.label, required: f.required, sort_order: f.sort_order, page: f.page, pos_x: f.pos_x, pos_y: f.pos_y, width: f.width, height: f.height })));
    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });
  }

  // 4) audit: created.
  const meta = requestMeta(req);
  await logEvent({
    document_id: doc.id,
    event_type: "created",
    actor: user.email,
    ip: meta.ip,
    user_agent: meta.user_agent,
    metadata: {
      original_sha256: originalHash,
      requires_countersignature: requiresCounter,
      kind,
      field_count: placedFields.length,
    },
  });

  return NextResponse.json({ id: doc.id });
}

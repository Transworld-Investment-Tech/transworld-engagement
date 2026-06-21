import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";

function cleanUpdate(input) {
  const errors = [];
  const out = {};

  if ("first_name" in input) {
    const v = (input.first_name || "").trim();
    if (!v) errors.push("First name is required");
    out.first_name = v;
  }
  if ("last_name" in input) {
    const v = (input.last_name || "").trim();
    if (!v) errors.push("Last name is required");
    out.last_name = v;
  }
  if ("email" in input) {
    const v = (input.email || "").trim().toLowerCase() || null;
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors.push("Email is not valid");
    out.email = v;
  }
  if ("date_of_birth" in input) {
    const v = (input.date_of_birth || "").trim() || null;
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors.push("Date of birth must be YYYY-MM-DD");
    out.date_of_birth = v;
  }
  if ("title" in input) out.title = (input.title || "").trim() || null;
  if ("phone" in input) out.phone = (input.phone || "").trim() || null;
  if ("notes" in input) out.notes = (input.notes || "").trim() || null;
  if ("status" in input) out.status = input.status === "inactive" ? "inactive" : "active";
  if ("tags" in input) {
    let tags = input.tags;
    if (typeof tags === "string") tags = tags.split(",").map((t) => t.trim()).filter(Boolean);
    out.tags = Array.isArray(tags) ? tags : [];
  }

  return { errors, value: out };
}

export async function GET(_req, { params }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  return NextResponse.json({ contact: data });
}

export async function PUT(req, { params }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json({ error: "You do not have permission to edit contacts" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { errors, value } = cleanUpdate(body);
  if (errors.length) return NextResponse.json({ error: errors.join(". ") }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("contacts")
    .update(value)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

export async function DELETE(_req, { params }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "admin")) {
    return NextResponse.json({ error: "Only an admin can delete a contact" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("contacts").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

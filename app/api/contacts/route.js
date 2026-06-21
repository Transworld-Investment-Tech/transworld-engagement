import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";

function cleanContact(input) {
  const errors = [];
  const first_name = (input.first_name || "").trim();
  const last_name = (input.last_name || "").trim();
  if (!first_name) errors.push("First name is required");
  if (!last_name) errors.push("Last name is required");

  const email = (input.email || "").trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Email is not valid");
  }

  let date_of_birth = (input.date_of_birth || "").trim() || null;
  if (date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
    errors.push("Date of birth must be YYYY-MM-DD");
  }

  let tags = input.tags;
  if (typeof tags === "string") {
    tags = tags.split(",").map((t) => t.trim()).filter(Boolean);
  }
  if (!Array.isArray(tags)) tags = [];

  return {
    errors,
    value: {
      title: (input.title || "").trim() || null,
      first_name,
      last_name,
      email,
      phone: (input.phone || "").trim() || null,
      date_of_birth,
      status: input.status === "inactive" ? "inactive" : "active",
      tags,
      notes: (input.notes || "").trim() || null,
    },
  };
}

export async function GET(req) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const status = searchParams.get("status");

  let query = supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (status === "active" || status === "inactive") {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ contacts: data });
}

export async function POST(req) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json({ error: "You do not have permission to add contacts" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { errors, value } = cleanContact(body);
  if (errors.length) {
    return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...value, created_by: user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ contact: data }, { status: 201 });
}

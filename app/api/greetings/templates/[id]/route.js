import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";
import { GREETING_TYPES } from "@/lib/greetings";

export const dynamic = "force-dynamic";

function cleanUpdate(input) {
  const errors = [];
  const out = {};

  if ("name" in input) {
    const v = (input.name || "").trim();
    if (!v) errors.push("Template name is required");
    out.name = v;
  }
  if ("subject" in input) {
    const v = (input.subject || "").trim();
    if (!v) errors.push("Subject is required");
    out.subject = v;
  }
  if ("html_body" in input) {
    const v = (input.html_body || "").trim();
    if (!v) errors.push("Message body is required");
    out.html_body = v;
  }
  if ("type" in input) {
    const v = (input.type || "custom").trim();
    out.type = GREETING_TYPES.includes(v) ? v : "custom";
  }
  if ("is_active" in input) out.is_active = !!input.is_active;

  return { errors, value: out };
}

export async function GET(_req, { params }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("greeting_templates")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function PUT(req, { params }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json(
      { error: "You do not have permission to edit templates" },
      { status: 403 }
    );
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
    .from("greeting_templates")
    .update(value)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_req, { params }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "admin")) {
    return NextResponse.json({ error: "Only an admin can delete a template" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("greeting_templates").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

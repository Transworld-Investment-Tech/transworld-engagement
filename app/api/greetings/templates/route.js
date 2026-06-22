import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";
import { GREETING_TYPES } from "@/lib/greetings";

export const dynamic = "force-dynamic";

function cleanTemplate(input) {
  const errors = [];
  const name = (input.name || "").trim();
  const subject = (input.subject || "").trim();
  const html_body = (input.html_body || "").trim();
  let type = (input.type || "custom").trim();

  if (!name) errors.push("Template name is required");
  if (!subject) errors.push("Subject is required");
  if (!html_body) errors.push("Message body is required");
  if (!GREETING_TYPES.includes(type)) type = "custom";

  return {
    errors,
    value: {
      name,
      type,
      subject,
      html_body,
      is_active: input.is_active === false ? false : true,
    },
  };
}

export async function GET(req) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const active = searchParams.get("active");

  let query = supabase
    .from("greeting_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (GREETING_TYPES.includes(type)) query = query.eq("type", type);
  if (active === "true") query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

export async function POST(req) {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json(
      { error: "You do not have permission to create templates" },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { errors, value } = cleanTemplate(body);
  if (errors.length) return NextResponse.json({ error: errors.join(". ") }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("greeting_templates")
    .insert({ ...value, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data }, { status: 201 });
}

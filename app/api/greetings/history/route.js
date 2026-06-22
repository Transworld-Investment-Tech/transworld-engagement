import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const status = searchParams.get("status");

  let query = supabase
    .from("greeting_logs")
    .select(
      "id,type,channel,subject,status,resend_id,error,sent_at,sent_by," +
        "contacts(first_name,last_name,email),greeting_templates(name)"
    )
    .order("sent_at", { ascending: false })
    .limit(300);

  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data });
}

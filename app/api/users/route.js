import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { getCurrentUser, hasRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// Active staff, for picking the executing officer when creating a document.
// manager+ (the same people who can create documents).
export async function GET() {
  const user = await getCurrentUser();
  if (!hasRole(user, "manager")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("app_users")
    .select("id,name,email,role")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}

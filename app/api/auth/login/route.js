import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { createToken, sessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: user, error } = await supabase
    .from("app_users")
    .select("id, name, email, password_hash, role, is_active")
    .eq("email", email)
    .maybeSingle();

  if (error || !user || !user.is_active) {
    return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401 });
  }

  const token = await createToken(user);
  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
  res.cookies.set(sessionCookie.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionCookie.maxAge,
  });
  return res;
}

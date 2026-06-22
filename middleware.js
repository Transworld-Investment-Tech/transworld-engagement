import { NextResponse } from "next/server";
import { readToken, sessionCookie } from "@/lib/auth";

const PUBLIC = ["/login"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow Next internals, static assets, and the login + auth endpoints.
  // `/sign` and `/api/sign` are the client signing flow: clients are not staff
  // and have no session, so these are public and secure THEMSELVES via the
  // one-time sign_token (+ an emailed OTP) — the same self-securing pattern the
  // cron route uses.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/sign") ||
    pathname.startsWith("/api/sign") ||
    PUBLIC.includes(pathname)
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(sessionCookie.name)?.value;
  const user = await readToken(token);

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

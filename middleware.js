import { NextResponse } from "next/server";
import { readToken, sessionCookie } from "@/lib/auth";

const PUBLIC = ["/login"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Public research site (client-facing, editorial). Everything under /research
  // is public EXCEPT /research/admin, which is the staff report-management
  // surface and stays behind the session gate below. The print route
  // (/research/print/*) is public here but self-secures draft rendering with the
  // PRINT_TOKEN header. /research/[slug] and /research/archive only ever read
  // published rows.
  const isPublicResearch =
    pathname === "/research" ||
    (pathname.startsWith("/research/") && !pathname.startsWith("/research/admin"));

  // The public PDF download endpoint (published reports only). The admin PDF
  // route lives at /api/research/admin/* and is NOT matched here, so it stays
  // gated.
  const isPublicResearchPdf = pathname.startsWith("/api/research/reports/");

  // The research unsubscribe endpoint (RFC 8058 one-click + the confirmation
  // page's POST). Public and self-securing via the per-contact unsubscribe
  // token — a client is not staff and has no session. The /research/unsubscribe
  // PAGE is already public (it's under /research and not /research/admin).
  const isPublicResearchUnsub = pathname.startsWith("/api/research/unsubscribe");

  // The Resend webhook. Public but self-securing: every request is verified
  // against RESEND_WEBHOOK_SECRET via the svix signature before anything is
  // read or written. Resend carries no session cookie.
  const isPublicResearchWebhook = pathname.startsWith("/api/research/webhooks/");

  // Allow Next internals, static assets, and the login + auth endpoints.
  // `/sign` and `/api/sign` are the client signing flow: clients are not staff
  // and have no session, so these are public and secure THEMSELVES via the
  // one-time sign_token (+ an emailed OTP) — the same self-securing pattern the
  // cron route uses.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/pdf.worker") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/sign") ||
    pathname.startsWith("/api/sign") ||
    isPublicResearch ||
    isPublicResearchPdf ||
    isPublicResearchUnsub ||
    isPublicResearchWebhook ||
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

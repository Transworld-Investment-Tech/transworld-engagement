"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Wordmark from "./Wordmark";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contacts", label: "Contacts" },
  // Greetings and Documents arrive in the next builds:
  { href: "/greetings", label: "Greetings", soon: true },
  { href: "/documents", label: "Documents", soon: true },
];

export default function AppShell({ user, children }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="bg-navy">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/dashboard">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-navy-200 sm:block">
              {user?.name} · <span className="capitalize">{user?.role}</span>
            </span>
            <button onClick={logout} className="text-xs font-medium text-navy-200 hover:text-white">
              Sign out
            </button>
          </div>
        </div>
        <div className="h-px bg-gold/70" />
        <nav className="mx-auto flex max-w-6xl gap-1 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <span key={item.href} className="relative">
                {item.soon ? (
                  <span className="inline-flex cursor-default items-center gap-1.5 px-3 py-3 text-sm text-navy-200/50">
                    {item.label}
                    <span className="rounded bg-navy-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-navy-200">
                      Soon
                    </span>
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className={
                      "inline-block px-3 py-3 text-sm transition-colors " +
                      (active
                        ? "font-medium text-white"
                        : "text-navy-200 hover:text-white")
                    }
                  >
                    {item.label}
                    {active && (
                      <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gold" />
                    )}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not sign in");
        setBusy(false);
        return;
      }
      const next = params.get("next") || "/dashboard";
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-5">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-navy p-10 lg:flex lg:col-span-2">
        <div className="font-serif text-2xl tracking-tight text-white">
          Transworld<span className="text-gold">.</span>
        </div>
        <div>
          <div className="eyebrow mb-3">Client Engagement</div>
          <h1 className="font-serif text-3xl leading-snug text-white">
            Greetings and signed documents,
            <br /> from one place.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-navy-200">
            Manage your client directory, send well-designed greetings, and
            collect signatures — all on Transworld's own infrastructure.
          </p>
        </div>
        <div className="text-[11px] text-navy-200/70">
          Transworld Investment &amp; Securities Limited · Confidential
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-12 lg:col-span-3">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="font-serif text-2xl tracking-tight text-navy">
              Transworld<span className="text-gold">.</span>
            </div>
          </div>
          <h2 className="font-serif text-2xl text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Use your Transworld staff account.</p>

          <div className="mt-7 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="you@transworldltd.com.ng"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button onClick={submit} disabled={busy} className="btn-primary w-full">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import SignaturePad from "@/components/SignaturePad";

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div>
            <div className="font-serif text-lg leading-none tracking-tight text-white">
              Transworld<span className="text-gold">.</span>
            </div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-navy-200">
              Investment &amp; Securities Limited
            </div>
          </div>
          <span className="hidden text-[11px] text-navy-200/80 sm:block">Secure signing</span>
        </div>
        <div className="h-[3px] bg-gold" />
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
      <footer className="mx-auto max-w-3xl px-5 pb-10 pt-2 text-[11px] text-muted">
        Transworld Investment &amp; Securities Limited · Lagos, Nigeria · Confidential
      </footer>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={"card p-5 sm:p-6 " + className}>{children}</div>;
}

export default function SignClient({ token }) {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [fatal, setFatal] = useState("");

  // signing state
  const [phase, setPhase] = useState("identity"); // identity → code → sign → done
  const [code, setCode] = useState("");
  const [sig, setSig] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [doneState, setDoneState] = useState(null); // "completed" | "awaiting"

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sign/${token}`);
        const d = await res.json();
        if (!res.ok) {
          setFatal(d.error || "This signing link is not valid.");
        } else if (d.state === "signed") {
          setPhase("done");
          setDoneState("already");
          setInfo(d);
        } else {
          setInfo(d);
        }
      } catch {
        setFatal("Something went wrong loading your document.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function call(action, extra) {
    const res = await fetch(`/api/sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Action failed");
    return d;
  }

  async function requestCode() {
    setBusy("code");
    setError("");
    try {
      await call("request-otp");
      setPhase("code");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function verifyCode() {
    setBusy("verify");
    setError("");
    try {
      await call("verify-otp", { otp: code.trim() });
      setPhase("sign");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function submit() {
    setBusy("submit");
    setError("");
    try {
      const d = await call("submit", {
        otp: code.trim(),
        signature_type: sig.type,
        signature_data: sig.data,
        consent: true,
      });
      setDoneState(d.completed ? "completed" : "awaiting");
      setPhase("done");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <Shell>
        <Card className="text-center text-sm text-muted">Loading your document…</Card>
      </Shell>
    );
  }

  if (fatal) {
    return (
      <Shell>
        <Card>
          <h1 className="font-serif text-2xl text-navy">We could not open this link</h1>
          <p className="mt-2 text-sm text-muted">{fatal}</p>
          <p className="mt-4 text-sm text-muted">
            Please contact your Transworld representative for a new link.
          </p>
        </Card>
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell>
        <Card>
          <div className="eyebrow">{info?.document?.title}</div>
          <h1 className="mt-1 font-serif text-2xl text-navy">
            {doneState === "already" ? "You have already signed" : "Thank you — your signature is recorded"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {doneState === "completed" &&
              "This document is now fully executed. A confirmation has been emailed to you."}
            {doneState === "awaiting" &&
              "Your signature has been captured. Transworld will countersign to complete the document, and you will receive a confirmation by email."}
            {doneState === "already" &&
              "No further action is needed. If you have questions, contact your Transworld representative."}
          </p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5">
        <div className="eyebrow">Document for your signature</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">{info.document.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Prepared for {info.signer.name}. Please review the document, then sign below.
        </p>
      </div>

      {/* Viewer */}
      <Card className="mb-5">
        {info.viewUrl ? (
          <div>
            <iframe
              title="Document"
              src={info.viewUrl}
              className="h-[55vh] w-full rounded-lg border border-line bg-white"
            />
            <a
              href={info.viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-navy-700 underline"
            >
              Open the document in a new tab
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted">
            The document preview could not be loaded. You can still sign below, or contact
            Transworld for assistance.
          </p>
        )}
      </Card>

      {/* Step 1 — identity */}
      <Card className="mb-5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
            1
          </span>
          <h2 className="font-serif text-lg text-navy">Confirm your identity</h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          For your protection, we will email a one-time code to <strong>{info.signer.email}</strong>.
          Enter it below to confirm it is you.
        </p>

        {phase === "identity" && (
          <button onClick={requestCode} disabled={busy === "code"} className="btn-primary mt-4">
            {busy === "code" ? "Sending…" : "Email me a one-time code"}
          </button>
        )}

        {(phase === "code" || phase === "sign") && (
          <div className="mt-4">
            <label className="label">One-time code</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="field max-w-[10rem] tracking-[0.3em]"
                value={code}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                disabled={phase === "sign"}
              />
              {phase === "code" ? (
                <button
                  onClick={verifyCode}
                  disabled={code.trim().length < 6 || busy === "verify"}
                  className="btn-primary"
                >
                  {busy === "verify" ? "Checking…" : "Verify"}
                </button>
              ) : (
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  Verified
                </span>
              )}
              {phase === "code" && (
                <button onClick={requestCode} disabled={busy === "code"} className="text-sm text-navy-700 underline">
                  Resend
                </button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Step 2 — sign */}
      <Card className={phase === "sign" ? "" : "opacity-50"}>
        <div className="flex items-center gap-2">
          <span
            className={
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white " +
              (phase === "sign" ? "bg-navy" : "bg-navy-200")
            }
          >
            2
          </span>
          <h2 className="font-serif text-lg text-navy">Sign the document</h2>
        </div>

        {phase === "sign" ? (
          <div className="mt-4">
            <SignaturePad defaultName={info.signer.name} onChange={setSig} />

            <label className="mt-4 flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                I, {info.signer.name}, agree to sign this document electronically, and I agree that
                my electronic signature is the legal equivalent of my handwritten signature.
              </span>
            </label>

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={!sig || !consent || busy === "submit"}
              className="btn-gold mt-4"
            >
              {busy === "submit" ? "Submitting…" : "Sign document"}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Confirm your identity above to continue.</p>
        )}
      </Card>

      {phase !== "sign" && error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </Shell>
  );
}

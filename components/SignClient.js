"use client";

import { useEffect, useMemo, useState } from "react";
import SignaturePad from "@/components/SignaturePad";
import PdfFieldLayer from "@/components/PdfFieldLayer";
import { formatSignDate, looksLikeNameField } from "@/lib/pdfFields";

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

  const [phase, setPhase] = useState("identity"); // identity → code → sign → done
  const [code, setCode] = useState("");
  const [sig, setSig] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [doneState, setDoneState] = useState(null);

  // in-document fields
  const [values, setValues] = useState({});
  const [padOpen, setPadOpen] = useState(false);
  const [padSig, setPadSig] = useState(null);

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

  const accept = info?.document?.kind === "acceptance";
  const fields = useMemo(() => info?.fields || [], [info]);
  const signatureFields = useMemo(() => fields.filter((f) => f.field_type === "signature"), [fields]);
  const hasSignatureField = signatureFields.length > 0;

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

  function seedValues() {
    const v = {};
    const today = formatSignDate(new Date());
    for (const f of fields) {
      if (f.field_type === "date") v[f.id] = today;
      else if (looksLikeNameField(f)) v[f.id] = info.signer.name || "";
    }
    setValues(v);
  }

  async function verifyCode() {
    setBusy("verify");
    setError("");
    try {
      await call("verify-otp", { otp: code.trim() });
      seedValues();
      setPhase("sign");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  const requiredMissing = useMemo(() => {
    return fields.some(
      (f) =>
        (f.field_type === "text" || f.field_type === "initial") &&
        f.required !== false &&
        !String(values[f.id] || "").trim()
    );
  }, [fields, values]);

  const canSubmit = consent && !!sig && !requiredMissing;

  async function submit() {
    if (!sig) {
      setError(
        hasSignatureField
          ? "Tap the signature field in the document to sign."
          : "Please add your signature below."
      );
      return;
    }
    setBusy("submit");
    setError("");
    try {
      const d = await call("submit", {
        otp: code.trim(),
        signature_type: sig.type,
        signature_data: sig.data,
        consent: true,
        field_values: values,
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
    const accepted = accept;
    return (
      <Shell>
        <Card>
          <div className="eyebrow">{info?.document?.title}</div>
          <h1 className="mt-1 font-serif text-2xl text-navy">
            {doneState === "already"
              ? accepted
                ? "You have already accepted"
                : "You have already signed"
              : accepted
              ? "Thank you — your acceptance is recorded"
              : "Thank you — your signature is recorded"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {doneState === "completed" &&
              (accepted
                ? "Your acceptance is confirmed. A copy has been emailed to you."
                : "This document is now fully executed. A confirmation has been emailed to you.")}
            {doneState === "awaiting" &&
              "Your signature has been captured. Transworld will countersign to complete the document, and you will receive a confirmation by email."}
            {doneState === "already" &&
              "No further action is needed. If you have questions, contact your Transworld representative."}
          </p>
        </Card>
      </Shell>
    );
  }

  const signMode = phase === "sign";

  return (
    <Shell>
      <div className="mb-5">
        <div className="eyebrow">{accept ? "Proposal for your acceptance" : "Document for your signature"}</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">{info.document.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Prepared for {info.signer.name}.{" "}
          {accept
            ? "Please review the proposal, then complete the fields and accept below."
            : "Please review the document, then complete the fields and sign below."}
        </p>
      </div>

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

      {/* Document with in-place fields */}
      <Card className="mb-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-serif text-lg text-navy">
            {signMode ? (accept ? "Complete & accept" : "Complete & sign") : "Review the document"}
          </h2>
          {info.viewUrl && (
            <a
              href={info.viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-navy-700 underline"
            >
              Open in a new tab
            </a>
          )}
        </div>

        {!signMode && (
          <p className="mb-3 text-sm text-muted">
            Confirm your identity above to fill in and {accept ? "accept" : "sign"} the document.
          </p>
        )}
        {signMode && fields.length > 0 && (
          <p className="mb-3 text-sm text-muted">
            Fill the highlighted fields{hasSignatureField ? " and tap the signature box to sign" : ""}.
            Date fields are filled with today's date automatically.
          </p>
        )}

        <div className="max-h-[72vh] overflow-y-auto rounded-lg bg-navy-50/30 p-2 sm:p-3">
          {info.fileUrl ? (
            <PdfFieldLayer
              src={{ url: info.fileUrl }}
              fields={fields}
              mode={signMode ? "sign" : "view"}
              values={values}
              onValue={(id, val) => setValues((p) => ({ ...p, [id]: val }))}
              signatureFor={(f) => (f.field_type === "signature" ? sig : null)}
              onSignRequest={() => {
                setPadSig(sig);
                setPadOpen(true);
              }}
            />
          ) : (
            <p className="p-4 text-sm text-muted">
              The document preview could not be loaded. Please contact Transworld for assistance.
            </p>
          )}
        </div>
      </Card>

      {/* Step 2 — sign / accept */}
      <Card className={signMode ? "" : "opacity-50"}>
        <div className="flex items-center gap-2">
          <span
            className={
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white " +
              (signMode ? "bg-navy" : "bg-navy-200")
            }
          >
            2
          </span>
          <h2 className="font-serif text-lg text-navy">{accept ? "Accept the proposal" : "Sign the document"}</h2>
        </div>

        {signMode ? (
          <div className="mt-4">
            {/* Signature: in-document field, or an inline pad when none is placed */}
            {hasSignatureField ? (
              <div className="rounded-lg border border-line bg-white p-3 text-sm">
                {sig ? (
                  <span className="inline-flex items-center gap-2 text-green-700">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-50 text-xs">
                      ✓
                    </span>
                    Signature added.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setPadSig(sig);
                        setPadOpen(true);
                      }}
                      className="text-navy-700 underline"
                    >
                      Change
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPadSig(null);
                      setPadOpen(true);
                    }}
                    className="btn-primary"
                  >
                    Tap to sign
                  </button>
                )}
              </div>
            ) : (
              <SignaturePad defaultName={info.signer.name} onChange={setSig} />
            )}

            <label className="mt-4 flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                I, {info.signer.name}, agree to {accept ? "accept" : "sign"} this document
                electronically, and I agree that my electronic {accept ? "acceptance and signature" : "signature"} is
                the legal equivalent of my handwritten signature.
              </span>
            </label>

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button onClick={submit} disabled={!canSubmit || busy === "submit"} className="btn-gold mt-4">
              {busy === "submit" ? "Submitting…" : accept ? "Accept proposal" : "Sign document"}
            </button>
            {requiredMissing && (
              <p className="mt-2 text-xs text-muted">Please complete all required fields above.</p>
            )}
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

      {/* signature modal */}
      {padOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-card">
            <h3 className="font-serif text-lg text-navy">Your signature</h3>
            <p className="mt-1 text-sm text-muted">Draw or type your signature, then apply it.</p>
            <div className="mt-3">
              <SignaturePad defaultName={info.signer.name} onChange={setPadSig} />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSig(padSig);
                  setPadOpen(false);
                }}
                disabled={!padSig}
                className="btn-primary"
              >
                Apply signature
              </button>
              <button type="button" onClick={() => setPadOpen(false)} className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

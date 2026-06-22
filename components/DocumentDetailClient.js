"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SignaturePad from "@/components/SignaturePad";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_KIND_LABELS,
  SIGNATORY_STATUS_LABELS,
  formatLagos,
  shortRef,
  nextSignatory,
} from "@/lib/documents";

const STATUS_STYLES = {
  draft: "bg-navy-50 text-navy-700",
  sent: "bg-gold-50 text-gold-600",
  partially_signed: "bg-gold-50 text-gold-600",
  completed: "bg-green-50 text-green-700",
  voided: "bg-red-50 text-red-700",
  expired: "bg-red-50 text-red-700",
};

const EVENT_LABELS = {
  created: "Created",
  sent: "Signing link sent",
  viewed: "Opened by signer",
  signed: "Client signed",
  countersigned: "Officer countersigned",
  completed: "Completed",
  downloaded: "Downloaded",
  voided: "Voided",
};

export default function DocumentDetailClient({ id, canManage, canDelete, currentUser }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  // officer countersign state
  const [sig, setSig] = useState(null);
  const [consent, setConsent] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load the document");
      setData(d);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(label, fn) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function post(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Action failed");
    return d;
  }

  if (error && !data) {
    return (
      <div className="card border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error} <Link href="/documents" className="underline">Back to documents</Link>
      </div>
    );
  }
  if (!data) return <div className="card p-8 text-center text-sm text-muted">Loading…</div>;

  const { document: doc, signatories, events } = data;
  const fields = data.fields || [];
  const turn = nextSignatory(signatories);
  const officer = signatories.find((s) => s.role === "officer");
  const officerTurn = turn && turn.role === "officer";
  const canCountersign =
    canManage &&
    officerTurn &&
    doc.status === "partially_signed" &&
    (!officer.app_user_id || officer.app_user_id === currentUser.id || canDelete);

  async function download() {
    const res = await fetch(`/api/documents/${id}/download`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Could not get the file");
    window.open(d.url, "_blank", "noopener");
  }

  return (
    <div>
      <Link href="/documents" className="text-sm text-navy-700 hover:underline">
        ← All documents
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Document · {shortRef(doc.id)}</div>
          <h1 className="mt-1 font-serif text-3xl text-ink">{doc.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {doc.original_filename} · created {formatLagos(doc.created_at)}
            {doc.expires_at ? ` · expires ${formatLagos(doc.expires_at)}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="chip">{DOCUMENT_KIND_LABELS[doc.kind] || "For signature"}</span>
            {fields.length > 0 && (
              <span className="chip">
                {fields.length} field{fields.length === 1 ? "" : "s"} placed
              </span>
            )}
          </div>
        </div>
        <span
          className={
            "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium " +
            (STATUS_STYLES[doc.status] || "bg-navy-50 text-navy-700")
          }
        >
          {DOCUMENT_STATUS_LABELS[doc.status] || doc.status}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: signatories + actions */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <h2 className="font-serif text-lg text-navy">Signatories</h2>
            <div className="mt-3 divide-y divide-line">
              {signatories.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {s.name}{" "}
                      <span className="text-xs font-normal text-muted">
                        · {s.role === "officer" ? "TISL officer" : "client"} · order {s.sign_order}
                      </span>
                    </div>
                    <div className="text-xs text-muted">
                      {s.email}
                      {s.signed_at ? ` · signed ${formatLagos(s.signed_at)}` : ""}
                    </div>
                  </div>
                  <span className="chip">{SIGNATORY_STATUS_LABELS[s.status] || s.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Officer countersignature */}
          {canCountersign && (
            <div className="card border-gold-200 p-5">
              <h2 className="font-serif text-lg text-navy">Your countersignature</h2>
              <p className="mt-1 text-sm text-muted">
                The client has signed. As the executing officer, add your signature to complete the
                document.
              </p>
              <div className="mt-4">
                <SignaturePad defaultName={currentUser.name} onChange={setSig} />
              </div>
              <label className="mt-4 flex items-start gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I am {currentUser.name}, and I consent to signing this document electronically on
                  behalf of Transworld Investment &amp; Securities Limited.
                </span>
              </label>
              <button
                disabled={!sig || !consent || busy === "countersign"}
                onClick={() =>
                  act("countersign", async () => {
                    const d = await post(`/api/documents/${id}/countersign`, {
                      signature_type: sig.type,
                      signature_data: sig.data,
                      consent: true,
                    });
                    setNotice(d.completed ? "Document completed." : "Countersignature recorded.");
                    setSig(null);
                    setConsent(false);
                  })
                }
                className="btn-gold mt-4"
              >
                {busy === "countersign" ? "Signing…" : "Countersign & complete"}
              </button>
            </div>
          )}

          {/* Audit trail */}
          <div className="card p-5">
            <h2 className="font-serif text-lg text-navy">Audit trail</h2>
            <ol className="mt-3 space-y-3">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 flex-none rounded-full bg-gold" />
                  <div>
                    <div className="text-ink">
                      {EVENT_LABELS[e.event_type] || e.event_type}
                      {e.metadata && e.metadata.reminder ? " (reminder)" : ""}
                    </div>
                    <div className="text-xs text-muted">
                      {formatLagos(e.created_at)} · {e.actor}
                      {e.ip ? ` · ${e.ip}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Right: actions */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-serif text-lg text-navy">Actions</h2>
            <div className="space-y-2">
              {canManage && (doc.status === "draft" || doc.status === "sent") && (
                <button
                  onClick={() =>
                    act("send", async () => {
                      await post(`/api/documents/${id}/send`);
                      setNotice("Signing link emailed to the client.");
                    })
                  }
                  disabled={busy === "send"}
                  className="btn-primary w-full"
                >
                  {busy === "send"
                    ? "Sending…"
                    : doc.status === "draft"
                    ? "Send signing link"
                    : "Resend signing link"}
                </button>
              )}

              {canManage && (doc.status === "sent" || doc.status === "partially_signed") && (
                <button
                  onClick={() =>
                    act("remind", async () => {
                      const d = await post(`/api/documents/${id}/remind`);
                      setNotice(
                        d.reminded === "officer"
                          ? "Reminder sent to the officer."
                          : "Reminder sent to the client."
                      );
                    })
                  }
                  disabled={busy === "remind"}
                  className="btn-ghost w-full"
                >
                  {busy === "remind" ? "Sending…" : "Send a reminder"}
                </button>
              )}

              <button
                onClick={() => act("download", download)}
                disabled={busy === "download"}
                className="btn-ghost w-full"
              >
                {busy === "download"
                  ? "Preparing…"
                  : doc.status === "completed"
                  ? doc.kind === "acceptance"
                    ? "Download accepted PDF"
                    : "Download signed PDF"
                  : "Download original"}
              </button>

              {canManage && !["completed", "voided"].includes(doc.status) && (
                <button
                  onClick={() => {
                    if (!confirm("Void this document? It can no longer be signed.")) return;
                    act("void", async () => {
                      const res = await fetch(`/api/documents/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "void" }),
                      });
                      const d = await res.json();
                      if (!res.ok) throw new Error(d.error || "Could not void");
                      setNotice("Document voided.");
                    });
                  }}
                  disabled={busy === "void"}
                  className="btn-danger w-full"
                >
                  {busy === "void" ? "Voiding…" : "Void document"}
                </button>
              )}

              {canDelete && (
                <button
                  onClick={() => {
                    if (!confirm("Permanently delete this document and its files?")) return;
                    act("delete", async () => {
                      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
                      const d = await res.json();
                      if (!res.ok) throw new Error(d.error || "Could not delete");
                      router.push("/documents");
                    });
                  }}
                  disabled={busy === "delete"}
                  className="btn-danger w-full"
                >
                  {busy === "delete" ? "Deleting…" : "Delete document"}
                </button>
              )}
            </div>
          </div>

          <div className="card p-5 text-sm text-muted">
            <div className="eyebrow mb-2">Integrity</div>
            {doc.sha256_hash ? (
              <p className="break-all font-mono text-xs text-ink">{doc.sha256_hash}</p>
            ) : (
              <p>A tamper-evidence hash is stamped once the document is completed.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

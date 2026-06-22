"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DOCUMENT_STATUS_LABELS } from "@/lib/documents";

const STATUS_STYLES = {
  draft: "bg-navy-50 text-navy-700",
  sent: "bg-gold-50 text-gold-600",
  partially_signed: "bg-gold-50 text-gold-600",
  completed: "bg-green-50 text-green-700",
  voided: "bg-red-50 text-red-700",
  expired: "bg-red-50 text-red-700",
};

function StatusChip({ status }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
        (STATUS_STYLES[status] || "bg-navy-50 text-navy-700")
      }
    >
      {DOCUMENT_STATUS_LABELS[status] || status}
    </span>
  );
}

export default function DocumentsClient({ canCreate, canDelete }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/documents");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load documents");
        setDocs(data.documents || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (filter === "open" && ["completed", "voided", "expired"].includes(d.status)) return false;
      if (filter === "completed" && d.status !== "completed") return false;
      if (!needle) return true;
      return (
        (d.title || "").toLowerCase().includes(needle) ||
        (d.client_name || "").toLowerCase().includes(needle)
      );
    });
  }, [docs, q, filter]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Documents</div>
          <h1 className="mt-1 font-serif text-3xl text-ink">Documents</h1>
          <p className="mt-1 text-sm text-muted">
            Send a document for signing and collect a client signature plus a TISL officer
            countersignature, with a full audit trail.
          </p>
        </div>
        {canCreate && (
          <Link href="/documents/new" className="btn-primary">
            New document
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="field max-w-xs"
          placeholder="Search by title or client…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="inline-flex rounded-lg border border-line bg-white p-0.5 text-sm">
          {[
            ["all", "All"],
            ["open", "In progress"],
            ["completed", "Completed"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={
                "rounded-md px-3 py-1.5 " +
                (filter === key ? "bg-navy text-white" : "text-muted hover:text-ink")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-sm text-muted">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-muted">
            {docs.length === 0
              ? "No documents yet."
              : "No documents match your search."}
          </p>
          {canCreate && docs.length === 0 && (
            <Link href="/documents/new" className="btn-primary mt-4">
              Create your first document
            </Link>
          )}
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {shown.map((d) => (
            <Link
              key={d.id}
              href={`/documents/${d.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-navy-50/50"
            >
              <div className="min-w-0">
                <div className="truncate font-serif text-lg text-navy">{d.title}</div>
                <div className="mt-0.5 text-sm text-muted">
                  {d.client_name || "—"}
                  {d.requires_countersignature ? " · countersigned" : ""}
                  {" · "}
                  {d.signed_count}/{d.signatory_count} signed
                </div>
              </div>
              <StatusChip status={d.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

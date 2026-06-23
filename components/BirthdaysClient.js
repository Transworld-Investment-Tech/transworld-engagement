"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { renderGreeting, formatDayMonth } from "@/lib/greetings";
import EmailPreview from "@/components/EmailPreview";

function nameOf(c) {
  return [c.title, c.first_name, c.last_name].filter(Boolean).join(" ").trim();
}

export default function BirthdaysClient({ canSend }) {
  const [ctx, setCtx] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [previewId, setPreviewId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [bRes, tRes] = await Promise.all([
      fetch("/api/greetings/birthdays"),
      fetch("/api/greetings/templates?type=birthday&active=true"),
    ]);
    const b = await bRes.json();
    const t = await tRes.json();
    setCtx(b);
    const tmpls = t.templates || [];
    setTemplates(tmpls);
    setTemplateId((prev) => prev || (tmpls[0] && tmpls[0].id) || "");
    setSelected(new Set((b.pending || []).map((c) => c.id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const template = templates.find((t) => t.id === templateId) || null;

  function toggle(id) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function release(ids) {
    if (!ids.length) return;
    if (!templateId) {
      setMsg({ kind: "error", text: "Choose a birthday template first." });
      return;
    }
    const who = ids.length === 1 ? "this greeting" : `${ids.length} greetings`;
    if (!confirm(`Send ${who} now? This cannot be undone.`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/greetings/birthdays/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release", contact_ids: ids, template_id: templateId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: "error", text: data.error || "Send failed." });
      return;
    }
    setMsg({
      kind: data.failed ? "warn" : "ok",
      text: `Sent ${data.sent}${data.failed ? `, ${data.failed} failed` : ""}.${
        data.warning ? " " + data.warning : ""
      }`,
    });
    load();
  }

  async function skip(ids) {
    if (!ids.length) return;
    if (!confirm(`Skip ${ids.length === 1 ? "this contact" : ids.length + " contacts"} for this year?`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/greetings/birthdays/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip", contact_ids: ids }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: "error", text: data.error || "Could not skip." });
      return;
    }
    setMsg({ kind: "ok", text: `Skipped ${data.skipped}.` });
    load();
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  const pending = ctx?.pending || [];
  const upcoming = ctx?.upcoming || [];
  const handled = (ctx?.today || []).filter((c) => c.handled);
  const noEmailToday = (ctx?.today || []).filter((c) => !c.handled && !c.email);
  const selectedIds = pending.filter((c) => selected.has(c.id)).map((c) => c.id);
  const previewContact = pending.find((c) => c.id === previewId);

  return (
    <div>
      <div className="mb-6">
        <div className="eyebrow">Greetings</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">Birthday queue</h1>
        <p className="mt-1 text-sm text-muted">
          {new Date(ctx.lagosDate + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          · Lagos
        </p>
      </div>

      {msg && (
        <div
          className={
            "mb-4 rounded-lg border px-3 py-2 text-sm " +
            (msg.kind === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : msg.kind === "warn"
              ? "border-gold-200 bg-gold-50 text-gold-600"
              : "border-emerald-200 bg-emerald-50 text-emerald-700")
          }
        >
          {msg.text}
        </div>
      )}

      {!canSend && (
        <div className="mb-4 rounded-lg border border-line bg-navy-50 px-3 py-2 text-sm text-muted">
          You can review the queue. Releasing greetings needs a manager or admin.
        </div>
      )}

      {/* Controls */}
      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label">Birthday template</label>
          <select
            className="field"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={!templates.length}
          >
            {templates.length ? (
              templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))
            ) : (
              <option value="">No active birthday template</option>
            )}
          </select>
        </div>
        {canSend && (
          <div className="flex gap-2">
            <button
              onClick={() => release(selectedIds)}
              disabled={busy || !selectedIds.length || !templateId}
              className="btn-gold"
            >
              Release selected ({selectedIds.length})
            </button>
            <button
              onClick={() => release(pending.map((c) => c.id))}
              disabled={busy || !pending.length || !templateId}
              className="btn-primary"
            >
              Release all
            </button>
          </div>
        )}
      </div>

      {!templates.length && (
        <div className="mb-6 rounded-lg border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-600">
          You need an active birthday template before you can release.{" "}
          <Link href="/greetings/templates/new" className="font-medium underline">
            Create one
          </Link>
          .
        </div>
      )}

      {/* Pending */}
      <h2 className="mb-3 font-serif text-xl text-ink">
        Today · {pending.length} to release
      </h2>
      {pending.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Nothing waiting. Every birthday today has been handled.
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {pending.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <label className="flex min-w-0 items-center gap-3">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{nameOf(c)}</span>
                  <span className="block truncate text-sm text-muted">{c.email}</span>
                </span>
              </label>
              <div className="flex items-center gap-2">
                <button onClick={() => setPreviewId(c.id)} className="btn-ghost text-xs" disabled={!template}>
                  Preview
                </button>
                {canSend && (
                  <>
                    <button onClick={() => release([c.id])} disabled={busy || !templateId} className="btn-gold text-xs">
                      Send
                    </button>
                    <button onClick={() => skip([c.id])} disabled={busy} className="btn-ghost text-xs">
                      Skip
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Already handled today */}
      {(handled.length > 0 || noEmailToday.length > 0) && (
        <div className="mt-6 space-y-1.5">
          {handled.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-1 text-sm text-muted">
              <span className="text-emerald-600">✓</span> {nameOf(c)} — handled today
            </div>
          ))}
          {noEmailToday.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-1 text-sm text-muted">
              <span className="text-gold-600">!</span> {nameOf(c)} — birthday today, but no email on file
            </div>
          ))}
        </div>
      )}

      {/* Upcoming heads-up */}
      <h2 className="mb-3 mt-10 font-serif text-xl text-ink">Next 7 days</h2>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted">No birthdays in the coming week.</p>
      ) : (
        <div className="card divide-y divide-line">
          {upcoming.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <span className="font-medium text-ink">{nameOf(c)}</span>
                {!c.email && <span className="ml-2 text-xs text-gold-600">no email</span>}
              </div>
              <div className="text-sm text-muted">
                {formatDayMonth(c.date_of_birth)} ·{" "}
                {c.inDays === 1 ? "tomorrow" : `in ${c.inDays} days`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewContact && template && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-deep/40 p-4"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="mt-10 w-full max-w-xl rounded-xl bg-white p-4 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="eyebrow">Preview</div>
                <div className="font-serif text-lg text-navy">{nameOf(previewContact)}</div>
              </div>
              <button onClick={() => setPreviewId(null)} className="btn-ghost text-xs">
                Close
              </button>
            </div>
            <EmailPreview html={renderGreeting(template, previewContact).html} height={460} />
            {canSend && (
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => { skip([previewContact.id]); setPreviewId(null); }} className="btn-ghost text-xs">
                  Skip
                </button>
                <button
                  onClick={() => { release([previewContact.id]); setPreviewId(null); }}
                  disabled={busy}
                  className="btn-gold text-xs"
                >
                  Send to {previewContact.first_name}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

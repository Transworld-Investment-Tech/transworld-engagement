"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { renderGreeting } from "@/lib/greetings";
import EmailPreview from "@/components/EmailPreview";

const SAMPLE = { title: "Mr", first_name: "Ada", last_name: "Okafor" };

export default function BroadcastClient({ templates, suggestedTags }) {
  const [templateId, setTemplateId] = useState((templates[0] && templates[0].id) || "");
  const [status, setStatus] = useState("active");
  const [tags, setTags] = useState([]);
  const [match, setMatch] = useState("any");
  const [tagInput, setTagInput] = useState("");
  const [count, setCount] = useState(null);
  const [sample, setSample] = useState([]);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const template = templates.find((t) => t.id === templateId) || null;
  const filter = useMemo(() => ({ status, tags, match }), [status, tags, match]);

  const preview = useMemo(
    () => (template ? renderGreeting(template, SAMPLE).html : ""),
    [template]
  );

  const refreshCount = useCallback(async () => {
    setCount(null);
    const res = await fetch("/api/greetings/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "count", filter }),
    });
    const data = await res.json();
    if (res.ok) {
      setCount(data.count);
      setSample(data.sample || []);
    }
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(refreshCount, 250);
    return () => clearTimeout(t);
  }, [refreshCount]);

  function toggleTag(tag) {
    setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));
  }
  function addFreeTag() {
    const v = tagInput.trim();
    if (v && !tags.includes(v)) setTags((c) => [...c, v]);
    setTagInput("");
  }

  async function sendTest() {
    setMsg(null);
    if (!template) return setMsg({ kind: "error", text: "Choose a template." });
    setBusy(true);
    const res = await fetch("/api/greetings/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "test", template_id: templateId, to: testTo }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? { kind: "ok", text: `Test sent to ${testTo}.` } : { kind: "error", text: data.error });
  }

  async function send() {
    setMsg(null);
    if (!template) return setMsg({ kind: "error", text: "Choose a template." });
    if (!count) return setMsg({ kind: "error", text: "No recipients match this filter." });
    if (!confirm(`Send "${template.name}" to ${count} recipient${count === 1 ? "" : "s"}? This cannot be undone.`))
      return;
    setBusy(true);
    const res = await fetch("/api/greetings/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "send", template_id: templateId, filter }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "error", text: data.error || "Send failed." });
    setMsg({
      kind: data.failed ? "warn" : "ok",
      text: `Sent ${data.sent}${data.failed ? `, ${data.failed} failed` : ""}.${data.warning ? " " + data.warning : ""}`,
    });
  }

  return (
    <div>
      <div className="mb-6">
        <div className="eyebrow">Greetings</div>
        <h1 className="mt-1 font-serif text-3xl text-ink">Broadcast</h1>
        <p className="mt-1 text-sm text-muted">A one-off email to a segment of your contacts.</p>
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

      {templates.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">You need an active template first.</p>
          <Link href="/greetings/templates/new" className="btn-primary mt-4">
            Create a template
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="label">Template</label>
              <select className="field" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Audience</label>
                <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Active contacts</option>
                  <option value="all">All contacts</option>
                </select>
              </div>
              <div>
                <label className="label">Tag match</label>
                <select className="field" value={match} onChange={(e) => setMatch(e.target.value)}>
                  <option value="any">Any selected tag</option>
                  <option value="all">All selected tags</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Filter by tags (optional)</label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {suggestedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={
                      "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors " +
                      (tags.includes(tag)
                        ? "bg-navy text-white"
                        : "bg-navy-50 text-navy-700 hover:bg-navy-200/60")
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="field"
                  placeholder="Add another tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFreeTag())}
                />
                <button type="button" onClick={addFreeTag} className="btn-ghost">
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                      <button onClick={() => toggleTag(tag)} className="ml-1.5 text-muted hover:text-ink">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-line bg-navy-50 px-4 py-3">
              <div className="font-serif text-2xl text-navy">
                {count == null ? "…" : count} recipient{count === 1 ? "" : "s"}
              </div>
              {sample.length > 0 && (
                <div className="mt-1 text-xs text-muted">
                  e.g. {sample.join(", ")}
                  {count > sample.length ? ", …" : ""}
                </div>
              )}
              <div className="mt-1 text-xs text-muted">Contacts without an email are excluded automatically.</div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <label className="label">Send a test to</label>
                <input
                  className="field"
                  placeholder="you@transworldltd.com.ng"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
              </div>
              <button onClick={sendTest} disabled={busy || !testTo} className="btn-ghost">
                Send test
              </button>
            </div>

            <button onClick={send} disabled={busy || !count} className="btn-primary w-full">
              {busy ? "Working…" : `Send to ${count || 0} recipient${count === 1 ? "" : "s"}`}
            </button>
          </div>

          <div>
            <div className="eyebrow mb-2">Preview</div>
            <EmailPreview html={preview} />
          </div>
        </div>
      )}
    </div>
  );
}

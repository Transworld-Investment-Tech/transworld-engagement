"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GREETING_TYPES, MERGE_TAGS, renderGreeting } from "@/lib/greetings";
import { STARTER_BODIES } from "@/lib/constants";
import EmailPreview from "@/components/EmailPreview";

const SAMPLE = { title: "Mr", first_name: "Ada", last_name: "Okafor" };

export default function GreetingTemplateForm({ initial = null }) {
  const router = useRouter();
  const editing = !!(initial && initial.id);

  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "birthday");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [htmlBody, setHtmlBody] = useState(
    initial?.html_body || STARTER_BODIES.birthday
  );
  const [isActive, setIsActive] = useState(initial?.is_active !== false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef(null);

  const preview = useMemo(
    () => renderGreeting({ type, subject, html_body: htmlBody }, SAMPLE).html,
    [type, subject, htmlBody]
  );

  function useStarter() {
    setHtmlBody(STARTER_BODIES[type] || STARTER_BODIES.custom);
  }

  function insertTag(tag) {
    const el = bodyRef.current;
    if (!el) {
      setHtmlBody((b) => b + tag);
      return;
    }
    const start = el.selectionStart ?? htmlBody.length;
    const end = el.selectionEnd ?? htmlBody.length;
    const next = htmlBody.slice(0, start) + tag + htmlBody.slice(end);
    setHtmlBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + tag.length;
    });
  }

  async function save() {
    setError("");
    if (!name.trim() || !subject.trim() || !htmlBody.trim()) {
      setError("Name, subject, and message body are all required.");
      return;
    }
    setBusy(true);
    const payload = { name, type, subject, html_body: htmlBody, is_active: isActive };
    const res = await fetch(
      editing ? `/api/greetings/templates/${initial.id}` : "/api/greetings/templates",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save the template.");
      return;
    }
    router.push("/greetings/templates");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="label">Template name</label>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Birthday — standard"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Type</label>
            <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
              {GREETING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
          </div>
        </div>

        <div>
          <label className="label">Subject line</label>
          <input
            className="field"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Happy birthday, {{first_name}}!"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0">Message body (HTML)</label>
            <button type="button" onClick={useStarter} className="text-xs font-medium text-navy-700 hover:text-navy">
              Use house-style starter
            </button>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {MERGE_TAGS.map((m) => (
              <button
                key={m.tag}
                type="button"
                onClick={() => insertTag(m.tag)}
                className="chip hover:bg-navy-200/60"
                title={`Insert ${m.label}`}
              >
                {m.tag}
              </button>
            ))}
          </div>
          <textarea
            ref={bodyRef}
            className="field font-mono text-xs"
            rows={14}
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-muted">
            The branded header, gold rule, and confidential footer are added automatically.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? "Saving…" : editing ? "Save changes" : "Create template"}
          </button>
          <button
            onClick={() => router.push("/greetings/templates")}
            className="btn-ghost"
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>

      <div>
        <div className="eyebrow mb-2">Live preview</div>
        <EmailPreview html={preview} />
        <p className="mt-2 text-xs text-muted">
          Sample shows {SAMPLE.title} {SAMPLE.first_name} {SAMPLE.last_name}.
        </p>
      </div>
    </div>
  );
}

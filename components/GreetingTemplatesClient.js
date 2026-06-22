"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const TYPE_LABEL = { birthday: "Birthday", holiday: "Holiday", custom: "Custom" };

export default function GreetingTemplatesClient({ canEdit, canDelete }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/greetings/templates");
    const data = await res.json();
    setTemplates(data.templates || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(t) {
    await fetch(`/api/greetings/templates/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !t.is_active }),
    });
    load();
  }

  async function remove(t) {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/greetings/templates/${t.id}`, { method: "DELETE" });
    if (res.ok) load();
    else {
      const d = await res.json();
      alert(d.error || "Could not delete");
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Greetings</div>
          <h1 className="mt-1 font-serif text-3xl text-ink">Templates</h1>
        </div>
        {canEdit && (
          <Link href="/greetings/templates/new" className="btn-primary">
            New template
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">No templates yet.</p>
          {canEdit && (
            <Link href="/greetings/templates/new" className="btn-primary mt-4">
              Create your first template
            </Link>
          )}
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg text-navy">{t.name}</span>
                  <span className="chip">{TYPE_LABEL[t.type] || t.type}</span>
                  {!t.is_active && (
                    <span className="inline-flex items-center rounded-full bg-line/60 px-2.5 py-0.5 text-xs font-medium text-muted">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-sm text-muted">{t.subject}</div>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button onClick={() => toggleActive(t)} className="btn-ghost text-xs">
                    {t.is_active ? "Deactivate" : "Activate"}
                  </button>
                )}
                {canEdit && (
                  <Link href={`/greetings/templates/${t.id}/edit`} className="btn-ghost text-xs">
                    Edit
                  </Link>
                )}
                {canDelete && (
                  <button onClick={() => remove(t)} className="btn-danger text-xs">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TITLES, SUGGESTED_TAGS } from "@/lib/constants";

export default function ContactForm({ initial, mode }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: initial?.title || "",
    first_name: initial?.first_name || "",
    last_name: initial?.last_name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    date_of_birth: initial?.date_of_birth || "",
    status: initial?.status || "active",
    tags: (initial?.tags || []).join(", "),
    notes: initial?.notes || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function addTag(tag) {
    const current = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (!current.includes(tag)) set("tags", [...current, tag].join(", "));
  }

  async function save() {
    setBusy(true);
    setError("");
    const url = mode === "edit" ? `/api/contacts/${initial.id}` : "/api/contacts";
    const method = mode === "edit" ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save");
        setBusy(false);
        return;
      }
      router.push("/contacts");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="card max-w-2xl p-6">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <select className="field" value={form.title} onChange={(e) => set("title", e.target.value)}>
            <option value="">—</option>
            {TITLES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">First name *</label>
          <input className="field" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Last name *</label>
          <input className="field" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
        </div>

        <div className="sm:col-span-3">
          <label className="label">Email</label>
          <input className="field" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="client@example.com" />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Phone</label>
          <input className="field" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+2348012345678" />
          <p className="mt-1 text-xs text-muted">Use +234 format for future WhatsApp greetings.</p>
        </div>

        <div className="sm:col-span-3">
          <label className="label">Date of birth</label>
          <input className="field" type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Status</label>
          <select className="field" value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="sm:col-span-6">
          <label className="label">Tags</label>
          <input className="field" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="HNW, Newsletter" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTED_TAGS.map((t) => (
              <button key={t} type="button" onClick={() => addTag(t)} className="chip hover:bg-navy-200/50">
                + {t}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-6">
          <label className="label">Notes</label>
          <textarea className="field min-h-[80px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Add contact"}
        </button>
        <button onClick={() => router.push("/contacts")} className="btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}

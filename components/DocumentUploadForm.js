"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEFAULT_EXPIRY_DAYS } from "@/lib/documents";

function contactLabel(c) {
  return [c.title, c.first_name, c.last_name].filter(Boolean).join(" ").trim();
}

export default function DocumentUploadForm({ currentUser }) {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [contactId, setContactId] = useState("");
  const [counter, setCounter] = useState(true);
  const [officerId, setOfficerId] = useState("");
  const [expiry, setExpiry] = useState(String(DEFAULT_EXPIRY_DAYS));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [cRes, uRes] = await Promise.all([
          fetch("/api/contacts?status=active"),
          fetch("/api/users"),
        ]);
        const cData = await cRes.json();
        const uData = await uRes.json();
        setContacts((cData.contacts || []).filter((c) => c.email));
        setOfficers(uData.users || []);
      } catch {
        setError("Could not load contacts and staff.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return setFile(null);
    if (f.type && f.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      setFile(null);
      return;
    }
    setError("");
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
  }

  async function submit() {
    setError("");
    if (!title.trim()) return setError("Give the document a title.");
    if (!file) return setError("Attach a PDF file.");
    if (!contactId) return setError("Choose the client who will sign.");

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim());
      fd.append("contact_id", contactId);
      fd.append("requires_countersignature", counter ? "true" : "false");
      if (counter && officerId) fd.append("officer_user_id", officerId);
      fd.append("expires_in_days", expiry);

      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the document");
      router.push(`/documents/${data.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="card p-8 text-center text-sm text-muted">Loading…</div>;
  }

  return (
    <div className="max-w-2xl">
      <div className="card space-y-5 p-6">
        <div>
          <label className="label">Document title</label>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Discretionary Mandate — Account Opening"
          />
        </div>

        <div>
          <label className="label">PDF file</label>
          <input type="file" accept="application/pdf" onChange={onFile} className="field" />
          {file && <p className="mt-1 text-xs text-muted">{file.name}</p>}
        </div>

        <div>
          <label className="label">Client (signs first)</label>
          <select className="field" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Select a client…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {contactLabel(c)} — {c.email}
              </option>
            ))}
          </select>
          {contacts.length === 0 && (
            <p className="mt-1 text-xs text-muted">
              No active contacts with an email.{" "}
              <Link href="/contacts/new" className="underline">
                Add one
              </Link>
              .
            </p>
          )}
        </div>

        <div className="rounded-lg border border-line bg-navy-50/40 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={counter}
              onChange={(e) => setCounter(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-ink">
              <span className="font-medium">Requires a TISL officer countersignature</span>
              <span className="block text-muted">
                The client signs first; an officer then executes it in the app.
              </span>
            </span>
          </label>

          {counter && (
            <div className="mt-4">
              <label className="label">Executing officer (optional)</label>
              <select
                className="field"
                value={officerId}
                onChange={(e) => setOfficerId(e.target.value)}
              >
                <option value="">Any manager or admin can countersign</option>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — {o.email} ({o.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="label">Signing link expires in</label>
          <select className="field max-w-[12rem]" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "Preparing…" : "Create document"}
          </button>
          <Link href="/documents" className="btn-ghost">
            Cancel
          </Link>
        </div>
        <p className="text-xs text-muted">
          Creating it does not send anything yet — you will send the signing link from the next
          screen.
        </p>
      </div>
    </div>
  );
}

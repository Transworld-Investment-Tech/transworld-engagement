"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

function formatDob(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export default function ContactsClient({ canEdit, canDelete, initialStatus = "active", initialBirthday = "" }) {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [birthday, setBirthday] = useState(initialBirthday);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const url = `/api/contacts?q=${encodeURIComponent(q)}&status=${status}&birthday=${birthday}`;
    const res = await fetch(url);
    const data = await res.json();
    setContacts(data.contacts || []);
    setLoading(false);
  }, [q, status, birthday]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(id, name) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
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
          <div className="eyebrow">Directory</div>
          <h1 className="mt-1 font-serif text-3xl text-ink">Contacts</h1>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setImportOpen(true)} className="btn-ghost">
              Import CSV
            </button>
            <Link href="/contacts/new" className="btn-primary">
              Add contact
            </Link>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="field max-w-xs"
          placeholder="Search name, email, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        <select className="field max-w-[200px]" value={birthday} onChange={(e) => setBirthday(e.target.value)}>
          <option value="">Any birthday</option>
          <option value="week">Birthday in next 7 days</option>
          <option value="month">Birthday this month</option>
        </select>
      </div>

      {birthday && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-200 bg-gold-50 px-4 py-2.5 text-sm text-navy">
          <span>
            Showing contacts with a{" "}
            <strong>{birthday === "week" ? "birthday in the next 7 days" : "birthday this month"}</strong>
            , soonest first.
          </span>
          <div className="flex items-center gap-3">
            <Link href="/greetings/birthdays" className="font-medium text-navy-700 hover:text-navy">
              Open birthday queue →
            </Link>
            <button onClick={() => setBirthday("")} className="font-medium text-navy-700 underline">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-navy-50 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Birthday</th>
              <th className="px-4 py-3 font-semibold">Tags</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Loading…</td></tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <p className="text-muted">No contacts yet.</p>
                  {canEdit && (
                    <p className="mt-1 text-sm text-muted">
                      Add one, or import a spreadsheet to get started.
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="border-b border-line/70 last:border-0 hover:bg-paper">
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">
                      {[c.title, c.first_name, c.last_name].filter(Boolean).join(" ")}
                    </span>
                    {c.status === "inactive" && (
                      <span className="ml-2 text-xs text-muted">(inactive)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-muted">{formatDob(c.date_of_birth)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).slice(0, 3).map((t) => (
                        <span key={t} className="chip">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canEdit && (
                      <Link href={`/contacts/${c.id}/edit`} className="text-sm font-medium text-navy-700 hover:text-navy">
                        Edit
                      </Link>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => remove(c.id, `${c.first_name} ${c.last_name}`)}
                        className="ml-4 text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && contacts.length > 0 && (
        <p className="mt-3 text-xs text-muted">{contacts.length} shown</p>
      )}

      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onDone={() => { setImportOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function ImportDialog({ onClose, onDone }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError("");
    setResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.data?.length) {
          setParseError("That file looks empty.");
          setRows(null);
          return;
        }
        setRows(res.data);
      },
      error: () => setParseError("Could not read that file."),
    });
  }

  async function runImport() {
    if (!rows) return;
    setBusy(true);
    const res = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setParseError(data.error || "Import failed");
      return;
    }
    setResult(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/40 p-4">
      <div className="card w-full max-w-lg p-6">
        <h3 className="font-serif text-xl text-ink">Import contacts</h3>
        <p className="mt-1 text-sm text-muted">
          Upload a CSV. Recognized columns:{" "}
          <span className="font-medium text-ink">first_name, last_name, email, phone, date_of_birth, title, tags</span>.
          Dates can be YYYY-MM-DD or DD/MM/YYYY. Existing contacts are matched by email and updated.
        </p>

        {!result && (
          <>
            <div className="mt-5">
              <label className="btn-ghost cursor-pointer">
                Choose file
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
              </label>
              {fileName && (
                <span className="ml-3 text-sm text-muted">
                  {fileName}{rows ? ` · ${rows.length} rows` : ""}
                </span>
              )}
            </div>
            {parseError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {parseError}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={onClose} className="btn-ghost">Cancel</button>
              <button onClick={runImport} disabled={!rows || busy} className="btn-primary">
                {busy ? "Importing…" : "Import"}
              </button>
            </div>
          </>
        )}

        {result && (
          <div className="mt-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-navy-50 p-3">
                <div className="font-serif text-2xl text-navy">{result.created}</div>
                <div className="text-xs text-muted">Added</div>
              </div>
              <div className="rounded-lg bg-navy-50 p-3">
                <div className="font-serif text-2xl text-navy">{result.updated}</div>
                <div className="text-xs text-muted">Updated</div>
              </div>
              <div className="rounded-lg bg-navy-50 p-3">
                <div className="font-serif text-2xl text-navy">{result.skipped}</div>
                <div className="text-xs text-muted">Skipped</div>
              </div>
            </div>
            {result.invalid?.length > 0 && (
              <div className="mt-4 max-h-40 overflow-auto rounded-lg border border-line p-3 text-xs text-muted">
                {result.invalid.map((iv, i) => (
                  <div key={i}>Row {iv.row}: {iv.reason}</div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button onClick={onDone} className="btn-primary">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

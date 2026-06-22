"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEFAULT_EXPIRY_DAYS } from "@/lib/documents";
import { FIELD_PALETTE } from "@/lib/pdfFields";
import PdfFieldLayer from "@/components/PdfFieldLayer";

function contactLabel(c) {
  return [c.title, c.first_name, c.last_name].filter(Boolean).join(" ").trim();
}

function genId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
    `f_${Math.random().toString(36).slice(2)}`;
}

export default function DocumentUploadForm({ currentUser }) {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [kind, setKind] = useState("signature"); // 'signature' | 'acceptance'
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState(null); // Uint8Array for the editor
  const [contactId, setContactId] = useState("");
  const [counter, setCounter] = useState(true);
  const [officerId, setOfficerId] = useState("");
  const [expiry, setExpiry] = useState(String(DEFAULT_EXPIRY_DAYS));

  // placement editor state
  const [fields, setFields] = useState([]);
  const [tool, setTool] = useState(null); // active palette item { type, label }
  const [selectedId, setSelectedId] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isAcceptance = kind === "acceptance";

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

  // Read the chosen PDF into memory so the editor can render it (no upload yet).
  useEffect(() => {
    if (!file) {
      setFileData(null);
      return;
    }
    let cancelled = false;
    file
      .arrayBuffer()
      .then((buf) => {
        if (!cancelled) setFileData(new Uint8Array(buf));
      })
      .catch(() => {
        if (!cancelled) setError("Could not read the PDF file.");
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

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
    setFields([]); // a new file invalidates any placed fields
    setSelectedId(null);
    setTool(null);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
  }

  function addField(field) {
    const id = genId();
    setFields((prev) => [...prev, { ...field, id, sort_order: prev.length }]);
    setSelectedId(id);
  }
  function updateField(id, patch) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function deleteField(id) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setSelectedId(null);
  }

  const selected = fields.find((f) => f.id === selectedId) || null;
  const hasSignatureField = fields.some((f) => f.field_type === "signature");

  async function submit() {
    setError("");
    if (!title.trim()) return setError("Give the document a title.");
    if (!file) return setError("Attach a PDF file.");
    if (!contactId) return setError("Choose the client who will sign.");

    setBusy(true);
    try {
      const payloadFields = fields.map((f, i) => ({
        role: "client",
        field_type: f.field_type,
        label: f.label,
        required: f.required !== false,
        page: f.page,
        pos_x: f.pos_x,
        pos_y: f.pos_y,
        width: f.width,
        height: f.height,
        sort_order: i,
      }));

      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim());
      fd.append("contact_id", contactId);
      fd.append("kind", kind);
      if (!isAcceptance) {
        fd.append("requires_countersignature", counter ? "true" : "false");
        if (counter && officerId) fd.append("officer_user_id", officerId);
      }
      fd.append("expires_in_days", expiry);
      fd.append("fields", JSON.stringify(payloadFields));

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
    <div className="space-y-6">
      <div className="card max-w-2xl space-y-5 p-6">
        {/* kind */}
        <div>
          <label className="label">Purpose</label>
          <div className="inline-flex rounded-lg border border-line bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setKind("signature")}
              className={
                "rounded-md px-3 py-1.5 " +
                (!isAcceptance ? "bg-navy text-white" : "text-muted hover:text-ink")
              }
            >
              For signature
            </button>
            <button
              type="button"
              onClick={() => setKind("acceptance")}
              className={
                "rounded-md px-3 py-1.5 " +
                (isAcceptance ? "bg-navy text-white" : "text-muted hover:text-ink")
              }
            >
              For acceptance (proposal)
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {isAcceptance
              ? "A TISL-prepared proposal the client reviews and accepts. Client-only — no officer countersignature."
              : "A document the client signs, optionally countersigned by a TISL officer."}
          </p>
        </div>

        <div>
          <label className="label">Document title</label>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              isAcceptance
                ? "e.g. Proposal for Dividend Recovery Services"
                : "e.g. Discretionary Mandate — Account Opening"
            }
          />
        </div>

        <div>
          <label className="label">PDF file</label>
          <input type="file" accept="application/pdf" onChange={onFile} className="field" />
          {file && <p className="mt-1 text-xs text-muted">{file.name}</p>}
        </div>

        <div>
          <label className="label">{isAcceptance ? "Client (accepts)" : "Client (signs first)"}</label>
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

        {!isAcceptance && (
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
        )}

        <div>
          <label className="label">Signing link expires in</label>
          <select className="field max-w-[12rem]" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </div>
      </div>

      {/* placement editor */}
      {file && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg text-navy">Place fields</h2>
              <p className="text-sm text-muted">
                Pick a field, then click on the page to drop it. Drag to move, use the corner to
                resize. Date fields fill in automatically on the signing date.
              </p>
            </div>
          </div>

          {/* palette */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {FIELD_PALETTE.map((p) => {
              const active = tool && tool.key === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setTool(active ? null : { key: p.key, type: p.type, label: p.label });
                    setSelectedId(null);
                  }}
                  className={
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors " +
                    (active
                      ? "border-navy bg-navy text-white"
                      : "border-line bg-white text-ink hover:bg-navy-50")
                  }
                >
                  + {p.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setTool(null)}
              className={
                "rounded-lg border px-3 py-1.5 text-sm font-medium " +
                (!tool ? "border-gold-600 bg-gold-50 text-gold-600" : "border-line bg-white text-muted hover:bg-navy-50")
              }
            >
              Select / move
            </button>
            <span className="ml-auto text-xs text-muted">
              {fields.length} field{fields.length === 1 ? "" : "s"} placed
            </span>
          </div>

          {tool && (
            <p className="mt-2 text-xs text-navy-700">
              Click on the page to place a <strong>{tool.label}</strong> field.
            </p>
          )}

          {/* inspector for the selected field */}
          {selected && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-navy-50/40 p-3">
              <div className="grow">
                <label className="label">Label (shown to the signer)</label>
                <input
                  className="field"
                  value={selected.label}
                  onChange={(e) => updateField(selected.id, { label: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={selected.required !== false}
                  onChange={(e) => updateField(selected.id, { required: e.target.checked })}
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => deleteField(selected.id)}
                className="btn-danger pb-2"
              >
                Remove field
              </button>
            </div>
          )}

          {isAcceptance && !hasSignatureField && (
            <div className="mt-3 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-xs text-gold-600">
              Tip: place a <strong>Signature</strong> field on the acceptance line so the client can
              sign in the document itself.
            </div>
          )}

          <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-lg bg-navy-50/30 p-3">
            {fileData ? (
              <PdfFieldLayer
                src={{ data: fileData }}
                fields={fields}
                mode="edit"
                tool={tool}
                selectedId={selectedId}
                onAdd={addField}
                onUpdate={updateField}
                onSelect={setSelectedId}
              />
            ) : (
              <div className="p-6 text-center text-sm text-muted">Reading PDF…</div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-2xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
        <p className="text-xs text-muted">
          Creating it does not send anything yet — you will send the link from the next screen.
        </p>
      </div>
    </div>
  );
}

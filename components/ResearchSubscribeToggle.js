"use client";

import { useState } from "react";

// The quick on/off switch on a single contact's record. The full roster lives
// at /research/admin/subscribers; this is the convenience entry point while
// you're already looking at a contact. House style (not the editorial sub-brand)
// — it's a Contacts-page control.

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ResearchSubscribeToggle({ contactId, initial, canEdit }) {
  const [sub, setSub] = useState(initial || null);
  const [tier, setTier] = useState(initial?.tier || "Standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isActive = sub?.status === "active";

  async function call(action, tierArg) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/contacts/${contactId}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tier: tierArg }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update subscription");
        setBusy(false);
        return;
      }
      setSub(data.subscription);
      if (data.subscription?.tier) setTier(data.subscription.tier);
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="card mt-6 max-w-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Research report</div>
          <h2 className="mt-1 font-serif text-xl text-ink">Weekly newsletter</h2>
        </div>
        {sub && (
          <span
            className={
              "chip " +
              (isActive
                ? "bg-green-50 text-green-700"
                : "bg-navy-50 text-muted")
            }
          >
            {isActive ? `Subscribed · ${sub.tier}` : sub.status}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-muted">
        Research is a separate channel. Subscribing or unsubscribing here does not
        affect this contact's birthday greetings or signing links.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!canEdit ? (
        <p className="mt-4 text-sm text-muted">
          {isActive
            ? `Subscribed (${sub.tier})${sub.created_at ? " since " + fmtDate(sub.created_at) : ""}.`
            : "Not subscribed. Ask a manager to subscribe this contact."}
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div>
            <label className="label">Tier</label>
            <select
              className="field max-w-[160px]"
              value={tier}
              onChange={(e) => {
                const t = e.target.value;
                setTier(t);
                // If already active, changing the tier applies immediately.
                if (isActive) call("subscribe", t);
              }}
              disabled={busy}
            >
              <option value="Standard">Standard</option>
              <option value="Premium">Premium</option>
            </select>
          </div>

          <div className="mt-6">
            {isActive ? (
              <button
                onClick={() => call("unsubscribe")}
                disabled={busy}
                className="btn-danger"
              >
                {busy ? "Working…" : "Unsubscribe"}
              </button>
            ) : (
              <button
                onClick={() => call("subscribe", tier)}
                disabled={busy}
                className="btn-primary"
              >
                {busy ? "Working…" : sub ? "Re-subscribe" : "Subscribe"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

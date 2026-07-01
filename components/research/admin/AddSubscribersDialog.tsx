'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import type { ClientTier } from '@/lib/research/types';
import {
  subscribeContactsAction,
  createContactAndSubscribeAction,
} from '@/app/research/admin/subscribers/actions';

const INK = '#0A1F44';
const MUTED = '#3A4A6B';
const GOLD = '#B08940';
const LINE = '#E8DFD0';
const CREAM = '#FAF7F2';

interface Contact {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  status: 'active' | 'inactive';
}

type Mode = 'directory' | 'new';

interface Props {
  subscribedIds: string[];
  onClose: () => void;
  onDone: () => void;
}

export function AddSubscribersDialog({ subscribedIds, onClose, onDone }: Props) {
  const already = new Set(subscribedIds);
  const [mode, setMode] = useState<Mode>('directory');
  const [tier, setTier] = useState<ClientTier>('Standard');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,31,68,0.45)' }}
    >
      <div
        className="w-full max-w-2xl"
        style={{
          background: CREAM,
          border: `1px solid ${LINE}`,
          borderRadius: 6,
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${LINE}` }}
        >
          <div>
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                color: GOLD,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Research · Audience
            </div>
            <h3
              className="font-display mt-1"
              style={{ fontSize: 22, color: INK, fontWeight: 600 }}
            >
              Add subscribers
            </h3>
          </div>
          <button type="button" onClick={onClose} style={{ color: MUTED }}>
            <X size={18} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 px-6 pt-4">
          <TabButton
            active={mode === 'directory'}
            onClick={() => {
              setMode('directory');
              setError(null);
            }}
          >
            From directory
          </TabButton>
          <TabButton
            active={mode === 'new'}
            onClick={() => {
              setMode('new');
              setError(null);
            }}
          >
            New contact
          </TabButton>
        </div>

        {/* Tier selector (shared) */}
        <div className="px-6 pt-4 flex items-center gap-3">
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              color: MUTED,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Tier
          </span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as ClientTier)}
            className="font-mono text-xs rounded px-2 py-1"
            style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, color: INK }}
          >
            <option value="Standard">Standard</option>
            <option value="Premium">Premium</option>
          </select>
        </div>

        {error && (
          <div
            className="mx-6 mt-4 rounded px-3 py-2 font-body text-sm"
            style={{ background: '#F8D7DA', color: '#842029' }}
          >
            {error}
          </div>
        )}

        {mode === 'directory' ? (
          <DirectoryPicker
            already={already}
            tier={tier}
            pending={pending}
            setError={setError}
            startTransition={startTransition}
            onDone={onDone}
          />
        ) : (
          <NewContactForm
            tier={tier}
            pending={pending}
            setError={setError}
            startTransition={startTransition}
            onDone={onDone}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-body text-sm px-3 py-2 transition"
      style={{
        color: active ? INK : MUTED,
        fontWeight: active ? 600 : 400,
        borderBottom: active ? `2px solid ${GOLD}` : '2px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

// ────────────── Directory picker ──────────────

function DirectoryPicker({
  already,
  tier,
  pending,
  setError,
  startTransition,
  onDone,
}: {
  already: Set<string>;
  tier: ClientTier;
  pending: boolean;
  setError: (s: string | null) => void;
  startTransition: (cb: () => Promise<void>) => void;
  onDone: () => void;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'active' | 'all'>('active');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const url = `/api/contacts?q=${encodeURIComponent(q)}&status=${status}`;
    try {
      const res = await fetch(url);
      const data = (await res.json()) as { contacts?: Contact[] };
      setContacts(data.contacts ?? []);
    } catch {
      setContacts([]);
    }
    setLoading(false);
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    if (selected.size === 0) {
      setError('Select at least one contact.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await subscribeContactsAction(Array.from(selected), tier);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone();
    });
  };

  const selectableShown = contacts.filter((c) => !already.has(c.id));

  return (
    <>
      <div className="px-6 pt-4 flex gap-2">
        <input
          className="font-body text-sm rounded px-3 py-2 flex-1"
          style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, color: INK }}
          placeholder="Search name, email, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'active' | 'all')}
          className="font-body text-sm rounded px-2 py-2"
          style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, color: INK }}
        >
          <option value="active">Active</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="px-6 mt-3 flex-1 overflow-auto" style={{ minHeight: 180 }}>
        {loading ? (
          <p className="font-body text-sm py-8 text-center" style={{ color: MUTED }}>
            Loading…
          </p>
        ) : contacts.length === 0 ? (
          <p className="font-body text-sm py-8 text-center" style={{ color: MUTED }}>
            No contacts match. Try “New contact” to add someone.
          </p>
        ) : (
          <ul>
            {contacts.map((c) => {
              const isSub = already.has(c.id);
              const isSel = selected.has(c.id);
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 py-2.5"
                  style={{ borderBottom: `1px solid ${LINE}` }}
                >
                  <button
                    type="button"
                    onClick={() => !isSub && toggle(c.id)}
                    disabled={isSub}
                    className="flex items-center justify-center rounded"
                    style={{
                      width: 20,
                      height: 20,
                      flexShrink: 0,
                      border: `1px solid ${isSel ? INK : LINE}`,
                      background: isSel ? INK : '#FFFFFF',
                      cursor: isSub ? 'default' : 'pointer',
                      opacity: isSub ? 0.4 : 1,
                    }}
                  >
                    {isSel && <Check size={13} color="#FFFFFF" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-body text-sm"
                      style={{ color: INK, fontWeight: 500 }}
                    >
                      {[c.title, c.first_name, c.last_name]
                        .filter(Boolean)
                        .join(' ')}
                    </div>
                    <div
                      className="font-mono text-xs break-all"
                      style={{ color: MUTED }}
                    >
                      {c.email || 'no email'}
                    </div>
                  </div>
                  {isSub && (
                    <span
                      className="font-mono text-xs"
                      style={{ color: '#0F5132', flexShrink: 0 }}
                    >
                      subscribed
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div
        className="flex items-center justify-between px-6 py-4 mt-2"
        style={{ borderTop: `1px solid ${LINE}` }}
      >
        <span className="font-mono text-xs" style={{ color: MUTED }}>
          {selected.size} selected
          {selectableShown.length === 0 && contacts.length > 0
            ? ' · all shown already subscribed'
            : ''}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            className="font-body text-sm px-4 py-2 rounded"
            style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, color: INK }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || selected.size === 0}
            className="font-body text-sm px-4 py-2 rounded transition hover:opacity-90 disabled:opacity-40"
            style={{ background: INK, color: CREAM, fontWeight: 500 }}
          >
            {pending ? 'Subscribing…' : `Subscribe ${selected.size || ''}`.trim()}
          </button>
        </div>
      </div>
    </>
  );
}

// ────────────── New contact form ──────────────

function NewContactForm({
  tier,
  pending,
  setError,
  startTransition,
  onDone,
}: {
  tier: ClientTier;
  pending: boolean;
  setError: (s: string | null) => void;
  startTransition: (cb: () => Promise<void>) => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    tags: '',
  });

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createContactAndSubscribeAction(form, tier);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone();
    });
  };

  const inputStyle: React.CSSProperties = {
    background: '#FFFFFF',
    border: `1px solid ${LINE}`,
    color: INK,
  };

  return (
    <>
      <div className="px-6 pt-4 flex-1 overflow-auto">
        <p className="font-body text-sm mb-4" style={{ color: MUTED }}>
          This creates the person in Contacts and subscribes them — every
          subscriber is a contact. If the email already belongs to a contact,
          that existing record is subscribed instead.
        </p>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-2">
            <Label>Title</Label>
            <input
              className="w-full font-body text-sm rounded px-3 py-2"
              style={inputStyle}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Mr"
            />
          </div>
          <div className="col-span-2">
            <Label>First name *</Label>
            <input
              className="w-full font-body text-sm rounded px-3 py-2"
              style={inputStyle}
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Label>Last name *</Label>
            <input
              className="w-full font-body text-sm rounded px-3 py-2"
              style={inputStyle}
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
            />
          </div>
          <div className="col-span-3">
            <Label>Email</Label>
            <input
              className="w-full font-body text-sm rounded px-3 py-2"
              style={inputStyle}
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="client@example.com"
            />
          </div>
          <div className="col-span-3">
            <Label>Phone</Label>
            <input
              className="w-full font-body text-sm rounded px-3 py-2"
              style={inputStyle}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+2348012345678"
            />
          </div>
          <div className="col-span-3">
            <Label>Date of birth</Label>
            <input
              className="w-full font-body text-sm rounded px-3 py-2"
              style={inputStyle}
              type="date"
              value={form.date_of_birth}
              onChange={(e) => set('date_of_birth', e.target.value)}
            />
          </div>
          <div className="col-span-3">
            <Label>Tags</Label>
            <input
              className="w-full font-body text-sm rounded px-3 py-2"
              style={inputStyle}
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="HNW, Newsletter"
            />
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-end gap-2 px-6 py-4 mt-2"
        style={{ borderTop: `1px solid ${LINE}` }}
      >
        <button
          type="button"
          onClick={onDone}
          className="font-body text-sm px-4 py-2 rounded"
          style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, color: INK }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="font-body text-sm px-4 py-2 rounded transition hover:opacity-90 disabled:opacity-40"
          style={{ background: INK, color: CREAM, fontWeight: 500 }}
        >
          {pending ? 'Adding…' : 'Add & subscribe'}
        </button>
      </div>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="font-mono block mb-1"
      style={{
        fontSize: 9,
        color: MUTED,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </label>
  );
}

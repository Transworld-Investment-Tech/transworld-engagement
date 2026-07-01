'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import type { Subscriber } from '@/lib/research/subscriptions';
import type { ClientStatus, ClientTier } from '@/lib/research/types';
import {
  setTierAction,
  unsubscribeContactAction,
  resubscribeContactAction,
  removeSubscriptionAction,
} from '@/app/research/admin/subscribers/actions';
import { AddSubscribersDialog } from '@/components/research/admin/AddSubscribersDialog';

const INK = '#0A1F44';
const MUTED = '#3A4A6B';
const GOLD = '#B08940';
const LINE = '#E8DFD0';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(new Date(iso));
}

function StatusBadge({ status }: { status: ClientStatus }) {
  const map: Record<ClientStatus, { bg: string; fg: string }> = {
    active: { bg: '#D1E7DD', fg: '#0F5132' },
    pending: { bg: '#FFF3CD', fg: '#664D03' },
    unsubscribed: { bg: '#EFEAE0', fg: '#3A4A6B' },
    bounced: { bg: '#F8D7DA', fg: '#842029' },
  };
  const c = map[status];
  return (
    <span
      className="font-mono text-xs px-2 py-1 rounded"
      style={{ background: c.bg, color: c.fg, letterSpacing: '0.08em' }}
    >
      {status.toUpperCase()}
    </span>
  );
}

interface Props {
  subscribers: Subscriber[];
  subscribedIds: string[];
  canDelete: boolean;
}

export function SubscribersManager({
  subscribers,
  subscribedIds,
  canDelete,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error: string | null }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const changeTier = (contactId: string, tier: ClientTier) =>
    run(() => setTierAction(contactId, tier));

  const unsubscribe = (s: Subscriber) => {
    if (!confirm(`Unsubscribe ${s.first_name} ${s.last_name} from research?`))
      return;
    run(() => unsubscribeContactAction(s.contact_id));
  };

  const resubscribe = (s: Subscriber) =>
    run(() => resubscribeContactAction(s.contact_id));

  const remove = (s: Subscriber) => {
    if (
      !confirm(
        `Permanently remove ${s.first_name} ${s.last_name}'s research subscription? The contact record is not affected.`
      )
    )
      return;
    run(() => removeSubscriptionAction(s.contact_id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2
          className="font-display"
          style={{ fontSize: 20, color: INK, fontWeight: 600 }}
        >
          Reader list{' '}
          <span className="font-mono" style={{ fontSize: 13, color: MUTED }}>
            ({subscribers.length})
          </span>
        </h2>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 font-body transition hover:opacity-90"
          style={{
            background: INK,
            color: '#FAF7F2',
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 9999,
            padding: '10px 18px',
          }}
        >
          <Plus size={15} /> Add subscribers
        </button>
      </div>

      {error && (
        <div
          className="mb-4 flex items-start justify-between gap-3 rounded px-3 py-2 font-body text-sm"
          style={{ background: '#F8D7DA', color: '#842029' }}
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {subscribers.length === 0 ? (
        <div
          className="p-12 text-center"
          style={{
            background: 'rgba(255,255,255,0.5)',
            border: `1px dashed ${LINE}`,
            borderRadius: 4,
          }}
        >
          <p className="font-body text-base" style={{ color: MUTED }}>
            No subscribers yet.
          </p>
          <p className="font-body text-sm mt-2" style={{ color: MUTED }}>
            Click “Add subscribers” to choose clients from the directory.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: '#FFFFFF',
            border: `1px solid ${LINE}`,
            borderRadius: 4,
            overflow: 'hidden',
            opacity: pending ? 0.6 : 1,
          }}
        >
          <div
            className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 font-body uppercase text-xs"
            style={{
              color: MUTED,
              letterSpacing: '0.16em',
              borderBottom: `1px solid ${LINE}`,
            }}
          >
            <div className="col-span-3">Name</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Tier</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Since</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {subscribers.map((s, i) => (
            <div
              key={s.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 items-center"
              style={{ borderTop: i === 0 ? 'none' : `1px solid ${LINE}` }}
            >
              <div className="md:col-span-3">
                <span
                  className="font-display text-sm"
                  style={{ color: INK, fontWeight: 600 }}
                >
                  {[s.title, s.first_name, s.last_name]
                    .filter(Boolean)
                    .join(' ')}
                </span>
                {s.contact_status === 'inactive' && (
                  <span
                    className="font-mono ml-2"
                    style={{ fontSize: 10, color: MUTED }}
                  >
                    (inactive)
                  </span>
                )}
                {s.subscribed_by_name && (
                  <div
                    className="font-mono mt-0.5"
                    style={{ fontSize: 10, color: MUTED }}
                  >
                    by {s.subscribed_by_name}
                  </div>
                )}
              </div>

              <div
                className="md:col-span-3 font-mono text-xs break-all"
                style={{ color: MUTED }}
              >
                {s.email || '—'}
              </div>

              <div className="md:col-span-2">
                <select
                  value={s.tier}
                  disabled={pending}
                  onChange={(e) =>
                    changeTier(s.contact_id, e.target.value as ClientTier)
                  }
                  className="font-mono text-xs rounded px-2 py-1"
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${LINE}`,
                    color: INK,
                  }}
                >
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <StatusBadge status={s.status} />
              </div>

              <div
                className="md:col-span-1 font-mono text-xs"
                style={{ color: MUTED }}
              >
                {fmtDate(s.created_at)}
              </div>

              <div className="md:col-span-2 flex items-center md:justify-end gap-3">
                {s.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => unsubscribe(s)}
                    disabled={pending}
                    className="font-body text-xs transition hover:opacity-70 disabled:opacity-40"
                    style={{ color: MUTED }}
                  >
                    Unsubscribe
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => resubscribe(s)}
                    disabled={pending}
                    className="font-body text-xs transition hover:opacity-70 disabled:opacity-40"
                    style={{ color: '#0F5132', fontWeight: 600 }}
                  >
                    Re-subscribe
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove(s)}
                    disabled={pending}
                    className="p-1.5 rounded transition hover:opacity-60 disabled:opacity-30"
                    style={{ color: '#842029' }}
                    title="Remove subscription"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <AddSubscribersDialog
          subscribedIds={subscribedIds}
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

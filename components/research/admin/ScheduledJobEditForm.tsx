'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Save, X, Users, CalendarClock, AlertCircle, Check, Loader2 } from 'lucide-react';
import type { Recipient } from '@/lib/research/subscriptions';
import {
  lagosInputToUtcIso,
  utcIsoToLagosInput,
  nowPlusMinutesLagosInput,
  formatLagos,
} from '@/lib/research/datetime';

const INK = '#0A1F44';
const MUTED = '#3A4A6B';
const GOLD = '#B08940';
const LINE = '#E8DFD0';
const CREAM = '#FAF7F2';

const MIN_LEAD_MS = 10 * 60 * 1000;

interface Props {
  jobId: string;
  slug: string;
  initialSubject: string;
  initialScheduledForIso: string;
  recipients: Recipient[];
  initialSelectedIds: string[];
}

export function ScheduledJobEditForm({
  jobId,
  slug,
  initialSubject,
  initialScheduledForIso,
  recipients,
  initialSelectedIds,
}: Props) {
  const router = useRouter();

  const originalIso = initialScheduledForIso;
  const originalInput = useMemo(() => utcIsoToLagosInput(initialScheduledForIso), [initialScheduledForIso]);
  // Pre-check the saved recipients that are still active subscribers.
  const originalSelected = useMemo(() => {
    const active = new Set(recipients.map((r) => r.contactId));
    return initialSelectedIds.filter((id) => active.has(id));
  }, [recipients, initialSelectedIds]);

  const [subject, setSubject] = useState(initialSubject);
  const [scheduleAt, setScheduleAt] = useState(originalInput);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(originalSelected));
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<'save' | 'cancel' | null>(null);

  const allSelected = selectedIds.size === recipients.length && recipients.length > 0;
  const minAttr = nowPlusMinutesLagosInput(10);
  const derivedIso = lagosInputToUtcIso(scheduleAt);

  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(recipients.map((r) => r.contactId)));
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSave = () => {
    if (!subject.trim()) {
      setFeedback({ kind: 'error', msg: 'Subject is required.' });
      return;
    }
    if (!derivedIso) {
      setFeedback({ kind: 'error', msg: 'Choose a valid date and time.' });
      return;
    }
    if (selectedIds.size === 0) {
      setFeedback({ kind: 'error', msg: 'Select at least one recipient.' });
      return;
    }

    // Send only what changed, so an untouched (and now near-due) time isn't
    // re-validated against the 10-minute minimum.
    const timeChanged = derivedIso !== originalIso;
    const subjectChanged = subject !== initialSubject;
    const selectionChanged =
      selectedIds.size !== originalSelected.length ||
      [...selectedIds].sort().join(',') !== [...originalSelected].sort().join(',');

    if (!timeChanged && !subjectChanged && !selectionChanged) {
      setFeedback({ kind: 'error', msg: 'No changes to save.' });
      return;
    }
    if (timeChanged && new Date(derivedIso).getTime() - Date.now() < MIN_LEAD_MS) {
      setFeedback({ kind: 'error', msg: 'Scheduled time must be at least 10 minutes in the future.' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = {};
    if (subjectChanged) body.subject = subject;
    if (timeChanged) body.scheduledFor = derivedIso;
    if (selectionChanged) body.contactIds = Array.from(selectedIds);

    setFeedback(null);
    setBusy('save');
    startTransition(async () => {
      try {
        const res = await fetch(`/api/research/scheduled-sends/${jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await res.json();
        if (!res.ok || !result.ok) {
          setFeedback({ kind: 'error', msg: result.error ?? 'Could not save changes.' });
          setBusy(null);
          return;
        }
        router.push('/research/admin/scheduled');
        router.refresh();
      } catch (err) {
        setFeedback({ kind: 'error', msg: (err as Error).message });
        setBusy(null);
      }
    });
  };

  const handleCancelSend = () => {
    if (!confirm('Cancel this scheduled send? It will not go out. This can\u2019t be undone.')) return;
    setFeedback(null);
    setBusy('cancel');
    startTransition(async () => {
      try {
        const res = await fetch(`/api/research/scheduled-sends/${jobId}`, { method: 'DELETE' });
        const result = await res.json();
        if (!res.ok || !result.ok) {
          setFeedback({ kind: 'error', msg: result.error ?? 'Could not cancel this send.' });
          setBusy(null);
          return;
        }
        router.push('/research/admin/scheduled');
        router.refresh();
      } catch (err) {
        setFeedback({ kind: 'error', msg: (err as Error).message });
        setBusy(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className="p-3 rounded font-body text-sm flex items-center gap-2"
          style={{
            background: feedback.kind === 'success' ? '#D1E7DD' : '#F8D7DA',
            color: feedback.kind === 'success' ? '#0F5132' : '#842029',
            border: `1px solid ${feedback.kind === 'success' ? '#a3cfbb' : '#f1aeb5'}`,
          }}
        >
          {feedback.kind === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {feedback.msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: subject + recipients */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-5" style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, borderRadius: 4 }}>
            <div className="font-body uppercase text-xs mb-2" style={{ color: MUTED, letterSpacing: '0.18em' }}>
              Subject line
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded font-display text-base focus:outline-none"
              style={{ border: `1px solid ${LINE}`, background: CREAM, color: INK, fontWeight: 500 }}
            />
            <div className="font-mono text-xs mt-2" style={{ color: MUTED }}>
              From: Transworld Investment &amp; Securities &lt;investment@transworldltd.com.ng&gt;
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, borderRadius: 4 }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${LINE}` }}>
              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: MUTED }} />
                <span className="font-body uppercase text-xs" style={{ color: MUTED, letterSpacing: '0.18em' }}>
                  Recipients · {selectedIds.size} of {recipients.length} selected
                </span>
              </div>
              <button
                type="button"
                onClick={toggleAll}
                className="font-mono text-xs underline transition hover:opacity-70"
                style={{ color: MUTED }}
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {recipients.map((r, i) => {
                const checked = selectedIds.has(r.contactId);
                return (
                  <label
                    key={r.contactId}
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-stone-50 transition"
                    style={{ borderTop: i === 0 ? 'none' : `1px solid ${LINE}` }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(r.contactId)}
                      className="w-4 h-4"
                      style={{ accentColor: INK }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-sm truncate" style={{ color: INK, fontWeight: 600 }}>
                        {r.name}
                      </div>
                      <div className="font-mono text-xs truncate" style={{ color: MUTED }}>
                        {r.email}
                      </div>
                    </div>
                    <span
                      className="font-mono text-xs px-2 py-0.5 rounded"
                      style={{
                        background: r.tier === 'Premium' ? '#D4B570' : LINE,
                        color: r.tier === 'Premium' ? INK : MUTED,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {r.tier}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: schedule + actions */}
        <div className="lg:col-span-5">
          <div className="p-5 sticky top-6" style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, borderRadius: 4 }}>
            <div className="font-body uppercase text-xs mb-4" style={{ color: GOLD, letterSpacing: '0.22em' }}>
              Send time
            </div>

            <label className="flex items-center gap-2 font-mono text-xs mb-2" style={{ color: MUTED }}>
              <CalendarClock size={13} /> Date &amp; time (Africa/Lagos, WAT)
            </label>
            <input
              type="datetime-local"
              value={scheduleAt}
              min={minAttr}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="w-full px-3 py-2 rounded font-mono text-sm focus:outline-none"
              style={{ border: `1px solid ${LINE}`, background: CREAM, color: INK }}
            />
            <p className="font-body text-xs mt-2" style={{ color: MUTED, lineHeight: 1.5 }}>
              {derivedIso ? (
                <>Fires at the first check on or after <strong style={{ color: INK }}>{formatLagos(derivedIso)}</strong>.</>
              ) : (
                'Choose when this broadcast should go out.'
              )}
            </p>

            <div className="mt-5 mb-5">
              <Link
                href={`/research/${slug}`}
                target="_blank"
                className="font-mono text-xs underline transition hover:opacity-70"
                style={{ color: MUTED, textDecoration: 'underline' }}
              >
                Preview the report on the web →
              </Link>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={pending}
                className="w-full px-4 py-3 rounded-full font-body text-sm flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-60"
                style={{ background: INK, color: CREAM, fontWeight: 500 }}
              >
                {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {busy === 'save' ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={handleCancelSend}
                disabled={pending}
                className="w-full px-4 py-3 rounded-full font-body text-sm flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-60"
                style={{ border: '1px solid #f1aeb5', color: '#842029', background: '#FFFFFF' }}
              >
                {busy === 'cancel' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel this send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

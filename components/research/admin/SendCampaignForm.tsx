'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { Send, AlertCircle, Check, Loader2, Users } from 'lucide-react';
import type { Recipient } from '@/lib/research/subscriptions';

const INK = '#0A1F44';
const MUTED = '#3A4A6B';
const GOLD = '#B08940';
const LINE = '#E8DFD0';
const CREAM = '#FAF7F2';

interface PriorSend {
  contact_id: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
}

interface Props {
  reportId: string;
  slug: string;
  defaultSubject: string;
  recipients: Recipient[];
  priorSends: PriorSend[];
}

type Status = 'idle' | 'testing' | 'sending' | 'done';

export function SendCampaignForm({
  reportId,
  slug,
  defaultSubject,
  recipients,
  priorSends,
}: Props) {
  const [subject, setSubject] = useState(defaultSubject);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(recipients.map((r) => r.contactId))
  );
  const [status, setStatus] = useState<Status>('idle');
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error';
    msg: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const priorByContact = useMemo(() => {
    const map = new Map<string, PriorSend>();
    for (const s of priorSends) map.set(s.contact_id, s);
    return map;
  }, [priorSends]);

  const hasPriorSend = priorSends.length > 0;
  const priorSentCount = priorSends.filter((s) => s.status === 'sent').length;
  const priorFailedCount = priorSends.filter((s) => s.status === 'failed').length;
  const lastSendDate =
    priorSends
      .map((s) => s.sent_at)
      .filter((d): d is string => !!d)
      .sort()
      .reverse()[0] ?? null;

  const allSelected = selectedIds.size === recipients.length && recipients.length > 0;
  const someSelected = selectedIds.size > 0;

  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(recipients.map((r) => r.contactId)));
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const selectOnlyMissed = () => {
    const sent = new Set(
      priorSends.filter((s) => s.status === 'sent').map((s) => s.contact_id)
    );
    setSelectedIds(new Set(recipients.filter((r) => !sent.has(r.contactId)).map((r) => r.contactId)));
  };

  const handleSendTest = () => {
    if (!subject.trim()) {
      setFeedback({ kind: 'error', msg: 'Subject is required.' });
      return;
    }
    setFeedback(null);
    setStatus('testing');
    startTransition(async () => {
      try {
        const res = await fetch('/api/research/send-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId, subject }),
        });
        const result = await res.json();
        if (!res.ok || !result.ok) {
          setFeedback({ kind: 'error', msg: result.error ?? 'Test send failed.' });
          setStatus('idle');
          return;
        }
        setFeedback({ kind: 'success', msg: `Test sent to ${result.sentTo}. Check your inbox.` });
        setStatus('idle');
      } catch (err) {
        setFeedback({ kind: 'error', msg: (err as Error).message });
        setStatus('idle');
      }
    });
  };

  const handleSendCampaign = () => {
    if (!subject.trim()) {
      setFeedback({ kind: 'error', msg: 'Subject is required.' });
      return;
    }
    if (selectedIds.size === 0) {
      setFeedback({ kind: 'error', msg: 'Select at least one recipient.' });
      return;
    }
    const confirmMsg = hasPriorSend
      ? `This report has already been sent to ${priorSentCount} subscriber(s). Send again to ${selectedIds.size} selected now?`
      : `Send this report to ${selectedIds.size} subscriber(s) now?`;
    if (!confirm(confirmMsg)) return;

    setFeedback(null);
    setStatus('sending');
    startTransition(async () => {
      try {
        const res = await fetch('/api/research/send-campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId, subject, contactIds: Array.from(selectedIds) }),
        });
        const result = await res.json();
        if (!res.ok || !result.ok) {
          setFeedback({ kind: 'error', msg: result.error ?? 'Send failed.' });
          setStatus('idle');
          return;
        }
        setStatus('done');
        setFeedback({
          kind: 'success',
          msg: `Sent to ${result.sentCount} of ${result.totalRecipients} recipient(s).${
            result.failedCount > 0 ? ` ${result.failedCount} failed.` : ''
          }`,
        });
      } catch (err) {
        setFeedback({ kind: 'error', msg: (err as Error).message });
        setStatus('idle');
      }
    });
  };

  if (recipients.length === 0) {
    return (
      <div
        className="p-12 text-center"
        style={{ background: 'rgba(255,255,255,0.5)', border: `1px dashed ${LINE}`, borderRadius: 4 }}
      >
        <Users size={32} style={{ color: MUTED, margin: '0 auto 12px' }} />
        <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: INK }}>
          No active subscribers
        </h2>
        <p className="font-body mt-2" style={{ color: MUTED }}>
          Subscribe clients first, then come back here to send the report.
        </p>
        <Link
          href="/research/admin/subscribers"
          className="mt-4 inline-block px-4 py-2 rounded-full font-body text-sm"
          style={{ background: INK, color: CREAM, textDecoration: 'none' }}
        >
          Manage subscribers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hasPriorSend && (
        <div
          className="p-4"
          style={{
            background: 'rgba(176, 137, 64, 0.08)',
            border: '1px solid rgba(176, 137, 64, 0.3)',
            borderRadius: 4,
          }}
        >
          <p className="font-body text-sm" style={{ color: '#664D03', lineHeight: 1.5 }}>
            <strong>This report has been sent before.</strong> {priorSentCount} successful,{' '}
            {priorFailedCount} failed
            {lastSendDate && (
              <>
                {' '}
                · last sent{' '}
                {new Date(lastSendDate).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Africa/Lagos',
                })}
              </>
            )}
            .
          </p>
          <button
            type="button"
            onClick={selectOnlyMissed}
            className="mt-2 font-mono text-xs underline transition hover:opacity-70"
            style={{ color: '#664D03' }}
          >
            Select only subscribers who haven&apos;t received it yet
          </button>
        </div>
      )}

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
            <div
              className="font-body uppercase text-xs mb-2"
              style={{ color: MUTED, letterSpacing: '0.18em' }}
            >
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
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${LINE}` }}
            >
              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: MUTED }} />
                <span
                  className="font-body uppercase text-xs"
                  style={{ color: MUTED, letterSpacing: '0.18em' }}
                >
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
                const prior = priorByContact.get(r.contactId);
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
                      <div
                        className="font-display text-sm truncate"
                        style={{ color: INK, fontWeight: 600 }}
                      >
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
                    {prior && prior.status === 'sent' && (
                      <span
                        className="font-mono text-xs px-2 py-0.5 rounded flex-shrink-0"
                        style={{ background: '#D1E7DD', color: '#0F5132', letterSpacing: '0.05em' }}
                        title={`Already sent ${prior.sent_at ? new Date(prior.sent_at).toLocaleString() : ''}`}
                      >
                        ✓ sent
                      </span>
                    )}
                    {prior && prior.status === 'failed' && (
                      <span
                        className="font-mono text-xs px-2 py-0.5 rounded flex-shrink-0"
                        style={{ background: '#F8D7DA', color: '#842029', letterSpacing: '0.05em' }}
                        title={prior.error_message ?? 'Failed previously'}
                      >
                        ✕ failed
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: action panel */}
        <div className="lg:col-span-5">
          <div
            className="p-5 sticky top-6"
            style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, borderRadius: 4 }}
          >
            <div
              className="font-body uppercase text-xs mb-4"
              style={{ color: GOLD, letterSpacing: '0.22em' }}
            >
              Ready to send
            </div>

            <div className="mb-5">
              <Link
                href={`/research/${slug}`}
                target="_blank"
                className="font-mono text-xs underline transition hover:opacity-70"
                style={{ color: MUTED, textDecoration: 'underline' }}
              >
                Preview the report on the web →
              </Link>
              <p className="font-body text-xs mt-2" style={{ color: MUTED, lineHeight: 1.5 }}>
                The email is rendered from the report&apos;s structured data. What you see on the
                public page is roughly what subscribers see — adapted for email.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleSendTest}
                disabled={pending || status === 'sending'}
                className="w-full px-4 py-3 rounded-full font-body text-sm flex items-center justify-center gap-2 transition hover:bg-stone-50 disabled:opacity-60"
                style={{ border: `1px solid ${LINE}`, color: INK, background: '#FFFFFF' }}
              >
                {status === 'testing' && <Loader2 size={14} className="animate-spin" />}
                {status === 'testing' ? 'Sending test…' : 'Send test to me first'}
              </button>

              <button
                type="button"
                onClick={handleSendCampaign}
                disabled={pending || !someSelected || status === 'sending' || status === 'done'}
                className="w-full px-4 py-3 rounded-full font-body text-sm flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-60"
                style={{ background: status === 'done' ? '#0F5132' : INK, color: CREAM, fontWeight: 500 }}
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Sending {selectedIds.size}…
                  </>
                ) : status === 'done' ? (
                  <>
                    <Check size={14} /> Sent
                  </>
                ) : (
                  <>
                    <Send size={14} /> Send to {selectedIds.size}{' '}
                    {selectedIds.size === 1 ? 'subscriber' : 'subscribers'}
                  </>
                )}
              </button>

              {status === 'done' && (
                <Link
                  href="/research/admin/reports"
                  className="block text-center font-mono text-xs underline transition hover:opacity-70"
                  style={{ color: MUTED, textDecoration: 'underline' }}
                >
                  Back to reports
                </Link>
              )}
            </div>

            <div
              className="mt-5 pt-4 font-mono text-xs"
              style={{ color: MUTED, borderTop: `1px solid ${LINE}`, lineHeight: 1.6 }}
            >
              <strong style={{ color: INK }}>What happens:</strong>
              <ol style={{ marginTop: 6, paddingLeft: 16, listStyle: 'decimal' }}>
                <li>Email rendered with each subscriber&apos;s unsubscribe link</li>
                <li>Sent in batches of 50 via Resend from investment@</li>
                <li>Per-recipient delivery logged in send_log</li>
                <li>Failed sends recorded with the error message</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

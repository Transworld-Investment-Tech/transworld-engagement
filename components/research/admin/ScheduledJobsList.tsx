'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  Users,
  Pencil,
  X,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import type { ScheduledJobWithReport } from '@/lib/research/jobs';
import { formatLagos } from '@/lib/research/datetime';

const INK = '#0A1F44';
const MUTED = '#3A4A6B';
const GOLD = '#B08940';
const LINE = '#E8DFD0';
const CREAM = '#FAF7F2';

interface Props {
  jobs: ScheduledJobWithReport[];
}

export function ScheduledJobsList({ jobs }: Props) {
  const router = useRouter();
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const handleCancel = async (job: ScheduledJobWithReport) => {
    if (
      !confirm(
        `Cancel the scheduled send for "${job.report_headline}"? It will not go out. This can't be undone.`
      )
    ) {
      return;
    }
    setFeedback(null);
    setCancelingId(job.id);
    try {
      const res = await fetch(`/api/research/scheduled-sends/${job.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        setFeedback({ kind: 'error', msg: result.error ?? 'Could not cancel this send.' });
        setCancelingId(null);
        return;
      }
      setFeedback({ kind: 'success', msg: 'Scheduled send cancelled.' });
      setCancelingId(null);
      router.refresh();
    } catch (err) {
      setFeedback({ kind: 'error', msg: (err as Error).message });
      setCancelingId(null);
    }
  };

  if (jobs.length === 0) {
    return (
      <div
        className="p-12 text-center"
        style={{ background: 'rgba(255,255,255,0.5)', border: `1px dashed ${LINE}`, borderRadius: 4 }}
      >
        <CalendarClock size={32} style={{ color: MUTED, margin: '0 auto 12px' }} />
        <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: INK }}>
          No sends scheduled
        </h2>
        <p className="font-body mt-2" style={{ color: MUTED }}>
          Open a published report and choose Schedule for later to queue one.
        </p>
        <Link
          href="/research/admin/reports"
          className="mt-4 inline-block px-4 py-2 rounded-full font-body text-sm"
          style={{ background: INK, color: CREAM, textDecoration: 'none' }}
        >
          Go to reports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {jobs.map((job) => {
        const isProcessing = job.status === 'processing';
        const isCanceling = cancelingId === job.id;
        return (
          <div
            key={job.id}
            className="p-5"
            style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, borderRadius: 4 }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div
                  className="font-mono"
                  style={{ fontSize: 10, color: GOLD, letterSpacing: '0.2em', textTransform: 'uppercase' }}
                >
                  {isProcessing ? 'Sending now' : 'Scheduled'}
                </div>
                <h3 className="font-display mt-1" style={{ fontSize: 20, color: INK, fontWeight: 600 }}>
                  {job.report_headline}
                </h3>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs" style={{ color: MUTED }}>
                    <CalendarClock size={12} /> {formatLagos(job.scheduled_for)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs" style={{ color: MUTED }}>
                    <Users size={12} /> {job.recipient_count}{' '}
                    {job.recipient_count === 1 ? 'recipient' : 'recipients'} selected
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isProcessing ? (
                  <span
                    className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded"
                    style={{ background: LINE, color: MUTED }}
                  >
                    <Loader2 size={12} className="animate-spin" /> Sending…
                  </span>
                ) : (
                  <>
                    <Link
                      href={`/research/admin/scheduled/${job.id}/edit`}
                      className="inline-flex items-center gap-1.5 font-body text-sm px-3 py-1.5 rounded-full transition hover:bg-stone-50"
                      style={{ border: `1px solid ${LINE}`, color: INK, textDecoration: 'none' }}
                    >
                      <Pencil size={13} /> Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleCancel(job)}
                      disabled={isCanceling}
                      className="inline-flex items-center gap-1.5 font-body text-sm px-3 py-1.5 rounded-full transition hover:opacity-90 disabled:opacity-60"
                      style={{ border: '1px solid #f1aeb5', color: '#842029', background: '#FFFFFF' }}
                    >
                      {isCanceling ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                      {isCanceling ? 'Cancelling…' : 'Cancel'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

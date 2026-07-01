'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { Pencil, Eye, Trash2, Send } from 'lucide-react';
import { deleteReportAction } from '@/app/research/admin/reports/actions';
import type { ReportSummary } from '@/lib/research/types';

// Phase 1 is the read side — no email is sent from it, so the reports table
// carries no "Sent" analytics column. That column and its data source return
// with the Phase 2 send side.

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`;
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ReportsTableProps {
  summaries: ReportSummary[];
}

export function ReportsTable({ summaries }: ReportsTableProps) {
  const [pending, startTransition] = useTransition();

  if (summaries.length === 0) {
    return (
      <div
        className="p-12 text-center"
        style={{
          background: 'rgba(255,255,255,0.5)',
          border: '1px dashed #E8DFD0',
          borderRadius: 4,
        }}
      >
        <p className="font-body text-base" style={{ color: '#3A4A6B' }}>
          No reports yet.
        </p>
        <p className="font-body text-sm mt-2" style={{ color: '#3A4A6B' }}>
          Click "New blank draft" above to create your first report.
        </p>
      </div>
    );
  }

  const handleDelete = (id: string, slug: string) => {
    if (
      !confirm(
        `Delete ${slug}? This will permanently remove the report and all its data.`
      )
    )
      return;
    startTransition(async () => {
      await deleteReportAction(id);
    });
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8DFD0',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <div
        className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 font-body uppercase text-xs"
        style={{
          color: '#3A4A6B',
          letterSpacing: '0.18em',
          borderBottom: '1px solid #E8DFD0',
        }}
      >
        <div className="col-span-2">Slug</div>
        <div className="col-span-4">Headline</div>
        <div className="col-span-2">Period</div>
        <div className="col-span-1">Status</div>
        <div className="col-span-2">Updated</div>
        <div className="col-span-1 text-right">Actions</div>
      </div>

      {summaries.map(({ report }, i) => {
        return (
        <div
          key={report.id}
          className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 items-center"
          style={{
            borderTop: i === 0 ? 'none' : '1px solid #E8DFD0',
            opacity: pending ? 0.6 : 1,
          }}
        >
          <div
            className="md:col-span-2 font-mono text-xs"
            style={{ color: '#B08940', letterSpacing: '0.1em' }}
          >
            {report.slug}
          </div>
          <div className="md:col-span-4">
            <span
              className="font-display text-sm"
              style={{ color: '#0A1F44', fontWeight: 600 }}
            >
              {report.headline}
            </span>
          </div>
          <div
            className="md:col-span-2 font-mono text-xs"
            style={{ color: '#3A4A6B' }}
          >
            {formatPeriod(report.period_start, report.period_end)}
          </div>
          <div className="md:col-span-1">
            <span
              className="font-mono text-xs px-2 py-1 rounded"
              style={{
                background:
                  report.status === 'published' ? '#D1E7DD' : '#FFF3CD',
                color:
                  report.status === 'published' ? '#0F5132' : '#664D03',
                letterSpacing: '0.1em',
              }}
            >
              {report.status.toUpperCase()}
            </span>
          </div>
          <div
            className="md:col-span-2 font-mono text-xs"
            style={{ color: '#3A4A6B' }}
          >
            {formatUpdated(report.updated_at)}
          </div>
          <div className="md:col-span-1 flex items-center md:justify-end gap-1">
            <Link
              href={`/research/admin/reports/${report.id}/edit`}
              className="p-2 rounded transition hover:bg-stone-100"
              style={{ color: '#0A1F44', textDecoration: 'none' }}
              title="Edit"
            >
              <Pencil size={14} />
            </Link>
            <Link
              href={`/research/admin/reports/${report.id}/preview`}
              className="p-2 rounded transition hover:bg-stone-100"
              style={{ color: '#0A1F44', textDecoration: 'none' }}
              title="Preview"
            >
              <Eye size={14} />
            </Link>
            {report.status === 'published' && (
              <Link
                href={`/research/admin/reports/${report.id}/send`}
                className="p-2 rounded transition hover:bg-stone-100"
                style={{ color: '#0A1F44', textDecoration: 'none' }}
                title="Send to subscribers"
              >
                <Send size={14} />
              </Link>
            )}
            <button
              type="button"
              onClick={() => handleDelete(report.id, report.slug)}
              disabled={pending}
              className="p-2 rounded transition hover:opacity-60 disabled:opacity-30"
              style={{ color: '#842029' }}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
}

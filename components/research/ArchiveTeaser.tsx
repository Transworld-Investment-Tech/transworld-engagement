import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReportSummary } from '@/lib/research/types';

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`;
}

interface ArchiveTeaserProps {
  reports: ReportSummary[];
}

export function ArchiveTeaser({ reports }: ArchiveTeaserProps) {
  return (
    <section className="max-w-7xl mx-auto px-6 mb-16">
      <div
        className="border-t pt-10"
        style={{ borderColor: '#E8DFD0' }}
      >
        <div className="flex items-end justify-between mb-6">
          <div>
            <div
              className="font-body uppercase text-xs mb-1.5"
              style={{ color: '#B08940', letterSpacing: '0.22em' }}
            >
              Previous Issues
            </div>
            <h2
              className="font-display"
              style={{
                fontSize: 28,
                color: '#0A1F44',
                fontWeight: 600,
                lineHeight: 1.1,
              }}
            >
              From the archive
            </h2>
          </div>
          <Link
            href="/research/archive"
            className="font-body text-sm flex items-center gap-2 hover:opacity-70 transition"
            style={{ color: '#0A1F44', textDecoration: 'none' }}
          >
            View all reports <ChevronRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map(({ report, metrics }) => (
            <Link
              key={report.id}
              href={`/research/${report.slug}`}
              className="block p-6 transition hover:bg-white"
              style={{
                border: '1px solid #E8DFD0',
                background: 'rgba(255,255,255,0.5)',
                textDecoration: 'none',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="font-mono text-xs"
                  style={{ color: '#B08940', letterSpacing: '0.22em' }}
                >
                  {report.slug}
                </div>
                <div
                  className="font-mono text-xs"
                  style={{ color: '#3A4A6B' }}
                >
                  {formatPeriod(report.period_start, report.period_end)}
                </div>
              </div>
              <h3
                className="font-display mb-3"
                style={{
                  fontSize: 20,
                  color: '#0A1F44',
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {report.headline}
              </h3>
              {metrics && (
                <div
                  className="flex items-center gap-4 font-mono text-xs num"
                  style={{ color: '#3A4A6B' }}
                >
                  <span>ASI {metrics.asi_value}</span>
                  {metrics.asi_change_pct !== null && (
                    <span
                      style={{
                        color:
                          Number(metrics.asi_change_pct) >= 0
                            ? '#0F5132'
                            : '#842029',
                      }}
                    >
                      {Number(metrics.asi_change_pct) >= 0 ? '+' : ''}
                      {Number(metrics.asi_change_pct).toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

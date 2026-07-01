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

interface ArchiveListProps {
  summaries: ReportSummary[];
}

export function ArchiveList({ summaries }: ArchiveListProps) {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      <div className="mb-12">
        <div
          className="font-body uppercase text-xs mb-2"
          style={{ color: '#B08940', letterSpacing: '0.22em' }}
        >
          The Archive
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 600,
            color: '#0A1F44',
            lineHeight: 1.05,
          }}
        >
          Every issue, since the beginning.
        </h1>
        <p
          className="font-body mt-4 text-base"
          style={{ color: '#3A4A6B', maxWidth: 540 }}
        >
          All weekly market reports remain available — searchable, archived,
          and ready to reference.
        </p>
      </div>

      {summaries.length === 0 ? (
        <p className="font-body text-base" style={{ color: '#3A4A6B' }}>
          No reports published yet.
        </p>
      ) : (
        <div>
          {summaries.map(({ report, metrics }, i) => (
            <Link
              key={report.id}
              href={`/research/${report.slug}`}
              className="grid grid-cols-12 gap-6 py-8 px-4 -mx-4 transition hover:bg-white"
              style={{
                borderTop: i === 0 ? '1px solid #E8DFD0' : 'none',
                borderBottom: '1px solid #E8DFD0',
                textDecoration: 'none',
              }}
            >
              <div
                className="col-span-12 md:col-span-2 font-mono text-xs"
                style={{ color: '#B08940', letterSpacing: '0.22em' }}
              >
                {report.slug}
                <div
                  className="mt-1"
                  style={{ color: '#3A4A6B', letterSpacing: 'normal' }}
                >
                  {formatPeriod(report.period_start, report.period_end)}
                </div>
              </div>
              <div className="col-span-12 md:col-span-7">
                <h3
                  className="font-display"
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: '#0A1F44',
                    lineHeight: 1.2,
                  }}
                >
                  {report.headline}
                </h3>
              </div>
              <div className="col-span-12 md:col-span-3 flex items-start justify-end gap-2">
                {metrics && (
                  <div className="text-right">
                    <div
                      className="font-mono text-xs num"
                      style={{ color: '#3A4A6B' }}
                    >
                      ASI
                    </div>
                    <div
                      className="font-display num"
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: '#0A1F44',
                      }}
                    >
                      {metrics.asi_value}
                    </div>
                    {metrics.asi_change_pct !== null && (
                      <div
                        className="font-mono text-xs num"
                        style={{
                          color:
                            Number(metrics.asi_change_pct) >= 0
                              ? '#0F5132'
                              : '#842029',
                        }}
                      >
                        {Number(metrics.asi_change_pct) >= 0 ? '+' : ''}
                        {Number(metrics.asi_change_pct).toFixed(2)}%
                      </div>
                    )}
                  </div>
                )}
                <ChevronRight
                  size={18}
                  style={{ color: '#0A1F44', marginTop: 6 }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

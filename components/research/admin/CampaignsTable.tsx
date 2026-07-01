import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { CampaignSummary } from '@/lib/research/analytics';

function formatLagos(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(new Date(iso));
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function CampaignsTable({ campaigns }: { campaigns: CampaignSummary[] }) {
  if (campaigns.length === 0) {
    return (
      <div
        className="p-12 text-center"
        style={{ background: 'rgba(255,255,255,0.5)', border: '1px dashed #E8DFD0', borderRadius: 4 }}
      >
        <p className="font-body text-base" style={{ color: '#3A4A6B' }}>
          No campaigns sent yet.
        </p>
        <p className="font-body text-sm mt-2" style={{ color: '#3A4A6B' }}>
          Send a report to see performance data here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8DFD0', borderRadius: 4, overflow: 'hidden' }}>
      <div
        className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 font-body uppercase text-xs"
        style={{ color: '#3A4A6B', letterSpacing: '0.18em', borderBottom: '1px solid #E8DFD0' }}
      >
        <div className="col-span-4">Campaign</div>
        <div className="col-span-2">Sent</div>
        <div className="col-span-1 text-right">Recipients</div>
        <div className="col-span-1 text-right">Delivered</div>
        <div className="col-span-1 text-right">Opens</div>
        <div className="col-span-1 text-right">Clicks</div>
        <div className="col-span-1 text-right">Bounced</div>
        <div className="col-span-1 text-right" />
      </div>

      {campaigns.map((c, i) => {
        const openRate = c.recipients ? c.opened / c.recipients : 0;
        const clickRate = c.recipients ? c.clicked / c.recipients : 0;
        return (
          <Link
            key={c.report_id}
            href={`/research/admin/analytics/${c.report_id}`}
            className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 items-center transition hover:bg-stone-50"
            style={{ borderTop: i === 0 ? 'none' : '1px solid #E8DFD0', textDecoration: 'none' }}
          >
            <div className="md:col-span-4">
              <div className="font-display text-sm" style={{ color: '#0A1F44', fontWeight: 600 }}>
                {c.report_headline}
              </div>
              <div className="font-mono text-xs mt-0.5" style={{ color: '#B08940', letterSpacing: '0.1em' }}>
                {c.report_slug}
              </div>
            </div>
            <div className="md:col-span-2 font-mono text-xs" style={{ color: '#3A4A6B' }}>
              {formatLagos(c.sent_at)}
            </div>
            <div className="md:col-span-1 md:text-right font-mono text-sm" style={{ color: '#0A1F44' }}>
              {c.recipients}
            </div>
            <div className="md:col-span-1 md:text-right font-mono text-sm" style={{ color: '#3A4A6B' }}>
              {c.delivered}
            </div>
            <div className="md:col-span-1 md:text-right">
              <div className="font-mono text-sm" style={{ color: '#0A1F44' }}>
                {c.opened}
              </div>
              <div className="font-mono text-xs" style={{ color: '#3A4A6B' }}>
                {pct(openRate)}
              </div>
            </div>
            <div className="md:col-span-1 md:text-right">
              <div className="font-mono text-sm" style={{ color: '#0A1F44' }}>
                {c.clicked}
              </div>
              <div className="font-mono text-xs" style={{ color: '#3A4A6B' }}>
                {pct(clickRate)}
              </div>
            </div>
            <div
              className="md:col-span-1 md:text-right font-mono text-sm"
              style={{ color: c.bounced > 0 ? '#842029' : '#3A4A6B' }}
            >
              {c.bounced || '—'}
            </div>
            <div className="md:col-span-1 md:text-right">
              <ArrowRight size={14} style={{ color: '#3A4A6B' }} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCampaignSummary, listCampaignRecipients } from '@/lib/research/analytics';
import { RecipientsTable } from '@/components/research/admin/RecipientsTable';

export const dynamic = 'force-dynamic';

function formatLagos(iso: string): string {
  return (
    new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Lagos',
      hour12: false,
    }).format(new Date(iso)) + ' WAT'
  );
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function CampaignDetailPage({
  params,
}: {
  params: { reportId: string };
}) {
  const { reportId } = params;
  const summary = await getCampaignSummary(reportId);
  if (!summary) notFound();
  const recipients = await listCampaignRecipients(reportId);

  const openRate = summary.recipients ? summary.opened / summary.recipients : 0;
  const clickRate = summary.recipients ? summary.clicked / summary.recipients : 0;
  const deliveredRate = summary.recipients ? summary.delivered / summary.recipients : 0;

  return (
    <div>
      <Link
        href="/research/admin/analytics"
        className="inline-flex items-center gap-1.5 font-mono text-xs mb-6 hover:opacity-70 transition"
        style={{ color: '#3A4A6B', textDecoration: 'none' }}
      >
        <ArrowLeft size={12} /> All campaigns
      </Link>

      <div className="mb-8 pb-6" style={{ borderBottom: '1px solid #E8DFD0' }}>
        <div
          className="font-mono"
          style={{ fontSize: 11, color: '#B08940', letterSpacing: '0.22em', textTransform: 'uppercase' }}
        >
          Campaign · {summary.report_slug}
        </div>
        <h1 className="font-display mt-2" style={{ fontSize: 34, color: '#0A1F44', fontWeight: 600 }}>
          {summary.report_headline}
        </h1>
        <p className="font-body mt-2" style={{ fontSize: 14, color: '#3A4A6B' }}>
          Sent {formatLagos(summary.sent_at)}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <Stat label="Recipients" value={summary.recipients} accent="#3A4A6B" />
        <Stat label="Delivered" value={summary.delivered} rate={pct(deliveredRate)} accent="#0F5132" />
        <Stat label="Opened" value={summary.opened} rate={pct(openRate)} accent="#0A1F44" />
        <Stat label="Clicked" value={summary.clicked} rate={pct(clickRate)} accent="#B08940" />
      </div>

      {(summary.bounced > 0 || summary.complained > 0 || summary.failed > 0) && (
        <div className="flex flex-wrap gap-4 mb-10">
          {summary.bounced > 0 && <MiniStat label="Bounced" value={summary.bounced} />}
          {summary.complained > 0 && <MiniStat label="Complaints" value={summary.complained} />}
          {summary.failed > 0 && <MiniStat label="Failed" value={summary.failed} />}
        </div>
      )}

      <RecipientsTable recipients={recipients} />
    </div>
  );
}

function Stat({
  label,
  value,
  rate,
  accent,
}: {
  label: string;
  value: number;
  rate?: string;
  accent: string;
}) {
  return (
    <div className="p-5" style={{ background: '#FFFFFF', border: '1px solid #E8DFD0', borderRadius: 4 }}>
      <div className="font-body uppercase text-xs mb-2" style={{ color: accent, letterSpacing: '0.18em' }}>
        {label}
      </div>
      <div className="font-display" style={{ fontSize: 32, fontWeight: 600, color: '#0A1F44', lineHeight: 1 }}>
        {value}
      </div>
      {rate && (
        <div className="font-mono text-xs mt-1" style={{ color: '#3A4A6B' }}>
          {rate}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="px-4 py-3"
      style={{ background: '#F8D7DA', border: '1px solid #f1aeb5', borderRadius: 4 }}
    >
      <span className="font-mono text-xs" style={{ color: '#842029', letterSpacing: '0.1em' }}>
        {label.toUpperCase()}: {value}
      </span>
    </div>
  );
}

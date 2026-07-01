import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { fetchAdminReportSummaries } from '@/lib/research/reports';
import { getSentIndicatorByReportId } from '@/lib/research/analytics';
import { ReportsTable } from '@/components/research/admin/ReportsTable';

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const [summaries, sentMap] = await Promise.all([
    fetchAdminReportSummaries(),
    getSentIndicatorByReportId(),
  ]);
  const sentInfo = Object.fromEntries(sentMap);

  return (
    <div>
      <Link
        href="/research/admin"
        className="inline-flex items-center gap-1.5 font-mono text-xs mb-6 hover:opacity-70 transition"
        style={{ color: '#3A4A6B', textDecoration: 'none' }}
      >
        <ArrowLeft size={12} /> Back to dashboard
      </Link>

      <div
        className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 pb-6"
        style={{ borderBottom: '1px solid #E8DFD0' }}
      >
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: 11,
              color: '#B08940',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            Research · Content
          </div>
          <h1
            className="font-display mt-2"
            style={{ fontSize: 34, color: '#0A1F44', fontWeight: 600 }}
          >
            Weekly reports
          </h1>
          <p
            className="font-body mt-2"
            style={{ fontSize: 14, color: '#3A4A6B' }}
          >
            Drafts are not visible on the public research site until published.
          </p>
        </div>
        <Link
          href="/research/admin/reports/new"
          className="inline-flex items-center gap-2 font-body transition hover:opacity-90"
          style={{
            background: '#0A1F44',
            color: '#FAF7F2',
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 9999,
            padding: '10px 18px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={15} /> New report
        </Link>
      </div>

      <ReportsTable summaries={summaries} sentInfo={sentInfo} />
    </div>
  );
}

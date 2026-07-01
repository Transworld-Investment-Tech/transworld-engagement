import { fetchLatestReport, fetchReportSummaries } from '@/lib/research/reports';
import { Portal } from '@/components/research/Portal';
import { EmptyState } from '@/components/research/EmptyState';
import { ArchiveTeaser } from '@/components/research/ArchiveTeaser';
import { Download } from 'lucide-react';

// Re-fetch from DB at most once per minute (ISR)
export const revalidate = 60;

export default async function ResearchHomePage() {
  const [data, summaries] = await Promise.all([
    fetchLatestReport(),
    fetchReportSummaries(),
  ]);

  if (!data) return <EmptyState />;

  const olderReports = summaries
    .filter((s) => s.report.id !== data.report.id)
    .slice(0, 2);

  return (
    <>
      {/* PDF download bar — slim, right-aligned, sits above the masthead */}
      <div className="max-w-7xl mx-auto px-6 pt-8 flex justify-end">
        <a
          href={`/api/research/reports/${encodeURIComponent(
            data.report.slug
          )}/pdf`}
          className="font-mono inline-flex items-center gap-2 transition hover:opacity-80"
          style={{
            fontSize: 11,
            color: '#0A1F44',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderBottom: '1px solid #B08940',
            paddingBottom: 3,
          }}
        >
          <Download size={12} />
          Download PDF
        </a>
      </div>

      <Portal data={data} />
      {olderReports.length > 0 && <ArchiveTeaser reports={olderReports} />}
    </>
  );
}

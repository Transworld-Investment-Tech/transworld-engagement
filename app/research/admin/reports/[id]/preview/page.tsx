import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Download } from 'lucide-react';
import { fetchAdminReportById } from '@/lib/research/reports';
import { Portal } from '@/components/research/Portal';
import type { FullReport } from '@/lib/research/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function PreviewReportPage({ params }: PageProps) {
  const { id } = params;
  const data = await fetchAdminReportById(id);
  if (!data) notFound();

  const canPreview = data.metrics !== null && data.outlook !== null;

  return (
    <>
      {/* Sticky preview banner */}
      <div
        className="px-6 py-3 flex flex-wrap items-center justify-between gap-2"
        style={{
          background: data.report.status === 'draft' ? '#FFF3CD' : '#D1E7DD',
          color: data.report.status === 'draft' ? '#664D03' : '#0F5132',
          borderBottom: `1px solid ${data.report.status === 'draft' ? '#ffe699' : '#a3cfbb'}`,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-xs px-2 py-1 rounded"
            style={{
              background: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
          >
            {data.report.status === 'draft' ? 'DRAFT PREVIEW' : 'LIVE'}
          </span>
          <span className="font-body text-sm">
            {data.report.status === 'draft'
              ? 'This is what the report will look like once published.'
              : 'This report is live on the public research site.'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {canPreview && (
            <a
              href={`/api/research/admin/reports/${id}/pdf`}
              className="font-mono text-xs flex items-center gap-1.5 hover:opacity-70 transition"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Download size={12} /> Download PDF
            </a>
          )}
          <Link
            href={`/research/admin/reports/${id}/edit`}
            className="font-mono text-xs flex items-center gap-1.5 hover:opacity-70 transition"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <ArrowLeft size={12} /> Back to editor
          </Link>
        </div>
      </div>

      {!canPreview ? (
        <main
          className="max-w-2xl mx-auto px-6 py-24 text-center"
          style={{ minHeight: '60vh' }}
        >
          <AlertTriangle
            size={40}
            color="#B08940"
            style={{ margin: '0 auto 16px' }}
          />
          <h1
            className="font-display"
            style={{ fontSize: 28, fontWeight: 600, color: '#0A1F44' }}
          >
            Not enough data to preview yet.
          </h1>
          <p className="font-body mt-3" style={{ color: '#3A4A6B', lineHeight: 1.6 }}>
            At minimum, the report needs metrics (NGX ASI + Market Cap) and an
            outlook direction filled in. Add those in the editor and try again.
          </p>
          <Link
            href={`/research/admin/reports/${id}/edit`}
            className="mt-6 inline-block px-4 py-2 rounded-full font-body text-sm"
            style={{
              background: '#0A1F44',
              color: '#FAF7F2',
              textDecoration: 'none',
            }}
          >
            Open editor
          </Link>
        </main>
      ) : (
        <Portal
          data={
            {
              report: data.report,
              metrics: data.metrics!,
              gainers: data.gainers,
              decliners: data.decliners,
              recommendations: data.recommendations,
              outlook: data.outlook!,
              news: data.news,
            } as FullReport
          }
        />
      )}
    </>
  );
}

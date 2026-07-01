import { fetchReportBySlug } from '@/lib/research/reports';
import { Portal } from '@/components/research/Portal';
import { notFound } from 'next/navigation';
import { Download } from 'lucide-react';
import type { Metadata } from 'next';

export const revalidate = 60;

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = params;
  const data = await fetchReportBySlug(slug);
  if (!data) {
    return { title: 'Report not found · Transworld Research' };
  }
  return {
    title: `${data.report.headline} · Transworld Research`,
    description: `Weekly market report for ${data.report.slug}.`,
  };
}

export default async function ReportPage({ params }: PageProps) {
  const { slug } = params;
  const data = await fetchReportBySlug(slug);
  if (!data) notFound();

  return (
    <>
      {/* PDF download bar — slim, right-aligned, sits above the masthead */}
      <div className="max-w-7xl mx-auto px-6 pt-8 flex justify-end">
        <a
          href={`/api/research/reports/${encodeURIComponent(slug)}/pdf`}
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
    </>
  );
}

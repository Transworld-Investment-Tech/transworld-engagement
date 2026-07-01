import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { fetchPrintableReportBySlug } from '@/lib/research/pdf/data';
import { PrintLayout } from '@/components/research/PrintLayout';

// Always render fresh — there is no caching at the print-page level. Caching
// happens at the PDF API route layer.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: { slug: string };
  searchParams: { draft?: string };
}

/**
 * Internal print route. Hit by Puppeteer to produce the editorial-style PDF.
 * Public in the router (Puppeteer carries no session), but self-secured: draft
 * rendering (status = 'draft' OR ?draft=1 watermarking) requires the
 * x-print-token header to match PRINT_TOKEN. Without it, only published reports
 * render and the draft watermark is suppressed.
 *
 * Accessible to humans too (no chrome), useful for previewing the print layout.
 */
export default async function PrintReportPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = params;
  const sp = searchParams;
  const headersList = headers();

  const incomingToken = headersList.get('x-print-token');
  const printToken = process.env.PRINT_TOKEN;
  const isAdminRender = Boolean(
    printToken && incomingToken && incomingToken === printToken
  );

  // Only the admin-rendered flow can fetch drafts.
  const data = await fetchPrintableReportBySlug(slug, isAdminRender);
  if (!data) notFound();

  // The draft watermark only shows when EITHER the report is actually a draft
  // (status === 'draft') OR explicitly requested via ?draft=1, AND the request
  // is admin-authenticated. Public renders never show the watermark.
  const isDraft =
    isAdminRender && (data.report.status === 'draft' || sp?.draft === '1');

  return <PrintLayout report={data} isDraft={isDraft} />;
}

import { fetchReportSummaries } from '@/lib/research/reports';
import { ArchiveList } from '@/components/research/ArchiveList';
import type { Metadata } from 'next';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Archive · Transworld Research',
  description:
    'Every weekly market report from Transworld Investment & Securities.',
};

export default async function ArchivePage() {
  const summaries = await fetchReportSummaries();
  return <ArchiveList summaries={summaries} />;
}

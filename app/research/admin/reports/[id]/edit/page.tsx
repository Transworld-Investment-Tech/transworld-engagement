import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAdminReportById } from '@/lib/research/reports';
import { ReportEditForm } from '@/components/research/admin/ReportEditForm';
import type { ReportFormState } from '@/app/research/admin/reports/actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

function toFormState(
  data: NonNullable<Awaited<ReturnType<typeof fetchAdminReportById>>>
): ReportFormState {
  const { report, metrics, gainers, decliners, recommendations, outlook, news } =
    data;

  const numStr = (n: number | null | undefined): string =>
    n === null || n === undefined ? '' : String(n);

  return {
    slug: report.slug,
    period_start: report.period_start,
    period_end: report.period_end,
    outlook_period_start: report.outlook_period_start,
    outlook_period_end: report.outlook_period_end,
    headline: report.headline,
    metrics: {
      asi_value: metrics?.asi_value ?? '',
      asi_change_pct: numStr(metrics?.asi_change_pct),
      mcap_value: metrics?.mcap_value ?? '',
      mcap_change_pct: numStr(metrics?.mcap_change_pct),
      volume_shares: metrics?.volume_shares ?? '',
      volume_change_pct: numStr(metrics?.volume_change_pct),
      value_traded: metrics?.value_traded ?? '',
      value_change_pct: numStr(metrics?.value_change_pct),
      deals: metrics?.deals ?? '',
      deals_change_pct: numStr(metrics?.deals_change_pct),
    },
    gainers: gainers.map((g) => ({
      company_name: g.company_name,
      open_price: numStr(g.open_price),
      close_price: numStr(g.close_price),
      change_pct: numStr(g.change_pct),
    })),
    decliners: decliners.map((d) => ({
      company_name: d.company_name,
      open_price: numStr(d.open_price),
      close_price: numStr(d.close_price),
      change_pct: numStr(d.change_pct),
    })),
    buy: recommendations.buy.map((r) => ({
      company_name: r.company_name,
      note: r.note ?? '',
    })),
    hold: recommendations.hold.map((r) => ({
      company_name: r.company_name,
      note: r.note ?? '',
    })),
    sell: recommendations.sell.map((r) => ({
      company_name: r.company_name,
      note: r.note ?? '',
    })),
    outlook: {
      direction: outlook?.direction ?? '',
      support: outlook?.support ?? '',
      resistance: outlook?.resistance ?? '',
      outperformers: outlook?.outperformers ?? [],
      underperformers: outlook?.underperformers ?? [],
      risks: outlook?.risks ?? [],
      catalysts: outlook?.catalysts ?? [],
    },
    news: news.map((n) => ({ title: n.title, body: n.body })),
  };
}

export default async function EditReportPage({ params }: PageProps) {
  const { id } = params;
  const data = await fetchAdminReportById(id);
  if (!data) notFound();

  const initialState = toFormState(data);

  return (
    <div>
      <Link
        href="/research/admin/reports"
        className="inline-flex items-center gap-1.5 font-mono text-xs mb-6 hover:opacity-70 transition"
        style={{ color: '#3A4A6B', textDecoration: 'none' }}
      >
        <ArrowLeft size={12} /> Back to reports
      </Link>

      <ReportEditForm
        reportId={data.report.id}
        initialState={initialState}
        status={data.report.status}
        publishedAt={data.report.published_at}
        sourcePdfUrl={data.report.source_pdf_url}
        parseConfidence={data.report.parse_confidence}
      />
    </div>
  );
}

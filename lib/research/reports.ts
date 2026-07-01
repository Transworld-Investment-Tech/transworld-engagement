import { getSupabaseServerClient } from '@/lib/research/supabase';
import { getSupabaseAdmin } from '@/lib/research/supabase';
import type {
  AdminReport,
  FullReport,
  Report,
  ReportMetrics,
  ReportMover,
  ReportRecommendation,
  ReportSummary,
} from '@/lib/research/types';

/**
 * Hydrates a Report with all its related data.
 * Returns null if essential pieces (metrics, outlook) are missing.
 * Used for the public-facing portal.
 */
async function hydrateReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  report: Report
): Promise<FullReport | null> {
  const [metricsRes, moversRes, recsRes, outlookRes, newsRes] =
    await Promise.all([
      supabase
        .from('report_metrics')
        .select('*')
        .eq('report_id', report.id)
        .maybeSingle(),
      supabase
        .from('report_movers')
        .select('*')
        .eq('report_id', report.id)
        .order('rank'),
      supabase
        .from('report_recommendations')
        .select('*')
        .eq('report_id', report.id)
        .order('display_order'),
      supabase
        .from('report_outlook')
        .select('*')
        .eq('report_id', report.id)
        .maybeSingle(),
      supabase
        .from('report_news')
        .select('*')
        .eq('report_id', report.id)
        .order('display_order'),
    ]);

  if (!metricsRes.data || !outlookRes.data) return null;

  const movers = (moversRes.data ?? []) as ReportMover[];
  const recs = (recsRes.data ?? []) as ReportRecommendation[];

  return {
    report,
    metrics: metricsRes.data,
    gainers: movers.filter((m) => m.kind === 'gainer'),
    decliners: movers.filter((m) => m.kind === 'decliner'),
    recommendations: {
      buy: recs.filter((r) => r.kind === 'buy'),
      hold: recs.filter((r) => r.kind === 'hold'),
      sell: recs.filter((r) => r.kind === 'sell'),
    },
    outlook: outlookRes.data,
    news: newsRes.data ?? [],
  };
}

/** Latest published report (homepage). */
export async function fetchLatestReport(): Promise<FullReport | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'published')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return hydrateReport(supabase, data);
}

/** Specific published report by slug (permalink pages). */
export async function fetchReportBySlug(
  slug: string
): Promise<FullReport | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !data) return null;
  return hydrateReport(supabase, data);
}

/** Lightweight summary of every published report. */
export async function fetchReportSummaries(): Promise<ReportSummary[]> {
  const supabase = getSupabaseServerClient();

  const reportsRes = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'published')
    .order('period_end', { ascending: false });

  if (
    reportsRes.error ||
    !reportsRes.data ||
    reportsRes.data.length === 0
  ) {
    return [];
  }

  const reportIds = reportsRes.data.map((r) => r.id);
  const metricsRes = await supabase
    .from('report_metrics')
    .select('*')
    .in('report_id', reportIds);

  const metricsMap = new Map<string, ReportMetrics>();
  for (const m of metricsRes.data ?? []) {
    metricsMap.set(m.report_id, m);
  }

  return reportsRes.data.map((report) => ({
    report,
    metrics: metricsMap.get(report.id) ?? null,
  }));
}

// ────────────── Admin fetchers (use service role, see drafts) ──────────────

/** All reports (drafts + published) for the admin reports list. */
export async function fetchAdminReportSummaries(): Promise<ReportSummary[]> {
  const supabase = getSupabaseAdmin();

  const reportsRes = await supabase
    .from('reports')
    .select('*')
    .order('updated_at', { ascending: false });

  if (
    reportsRes.error ||
    !reportsRes.data ||
    reportsRes.data.length === 0
  ) {
    return [];
  }

  const reportIds = reportsRes.data.map((r) => r.id);
  const metricsRes = await supabase
    .from('report_metrics')
    .select('*')
    .in('report_id', reportIds);

  const metricsMap = new Map<string, ReportMetrics>();
  for (const m of metricsRes.data ?? []) {
    metricsMap.set(m.report_id, m);
  }

  return reportsRes.data.map((report) => ({
    report,
    metrics: metricsMap.get(report.id) ?? null,
  }));
}

/** Single report by id, including drafts and partial data. */
export async function fetchAdminReportById(
  id: string
): Promise<AdminReport | null> {
  const supabase = getSupabaseAdmin();

  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !report) return null;

  const [metricsRes, moversRes, recsRes, outlookRes, newsRes] =
    await Promise.all([
      supabase
        .from('report_metrics')
        .select('*')
        .eq('report_id', report.id)
        .maybeSingle(),
      supabase
        .from('report_movers')
        .select('*')
        .eq('report_id', report.id)
        .order('rank'),
      supabase
        .from('report_recommendations')
        .select('*')
        .eq('report_id', report.id)
        .order('display_order'),
      supabase
        .from('report_outlook')
        .select('*')
        .eq('report_id', report.id)
        .maybeSingle(),
      supabase
        .from('report_news')
        .select('*')
        .eq('report_id', report.id)
        .order('display_order'),
    ]);

  const movers = (moversRes.data ?? []) as ReportMover[];
  const recs = (recsRes.data ?? []) as ReportRecommendation[];

  return {
    report,
    metrics: metricsRes.data ?? null,
    gainers: movers.filter((m) => m.kind === 'gainer'),
    decliners: movers.filter((m) => m.kind === 'decliner'),
    recommendations: {
      buy: recs.filter((r) => r.kind === 'buy'),
      hold: recs.filter((r) => r.kind === 'hold'),
      sell: recs.filter((r) => r.kind === 'sell'),
    },
    outlook: outlookRes.data ?? null,
    news: newsRes.data ?? [],
  };
}

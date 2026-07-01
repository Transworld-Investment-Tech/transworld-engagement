import { getSupabaseServerClient } from '@/lib/research/supabase';
import { getSupabaseAdmin } from '@/lib/research/supabase';
import type {
  FullReport,
  ReportMover,
  ReportRecommendation,
} from '@/lib/research/types';

/**
 * Fetch a fully-hydrated report by slug for printing.
 *
 * - allowDraft = false  → only returns published reports (public flow)
 * - allowDraft = true   → returns any status, including drafts (admin flow,
 *                          gated by PRINT_TOKEN at the route layer)
 *
 * Returns null if the report isn't found OR if essential pieces (metrics,
 * outlook) are missing — same contract as fetchReportBySlug.
 */
export async function fetchPrintableReportBySlug(
  slug: string,
  allowDraft: boolean
): Promise<FullReport | null> {
  // Admin client for drafts (RLS-bypassing service role); public client otherwise.
  const supabase = allowDraft ? getSupabaseAdmin() : getSupabaseServerClient();

  const baseQuery = supabase.from('reports').select('*').eq('slug', slug);
  const { data: report } = await (allowDraft
    ? baseQuery.maybeSingle()
    : baseQuery.eq('status', 'published').maybeSingle());

  if (!report) return null;

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

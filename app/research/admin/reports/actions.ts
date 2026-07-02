'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireResearchManager } from '@/lib/research/auth';
import { getSupabaseAdmin } from '@/lib/research/supabase';
import { deleteReportPdf } from '@/lib/research/storage';
import { deleteCachedPdf } from '@/lib/research/storage-rendered';
import { cancelJobsForReport } from '@/lib/research/jobs';

// ────────────── Form payload shape ──────────────

export interface ReportFormState {
  slug: string;
  period_start: string;
  period_end: string;
  outlook_period_start: string;
  outlook_period_end: string;
  headline: string;
  metrics: {
    asi_value: string;
    asi_change_pct: string;
    mcap_value: string;
    mcap_change_pct: string;
    volume_shares: string;
    volume_change_pct: string;
    value_traded: string;
    value_change_pct: string;
    deals: string;
    deals_change_pct: string;
  };
  gainers: Array<MoverInput>;
  decliners: Array<MoverInput>;
  buy: Array<RecInput>;
  hold: Array<RecInput>;
  sell: Array<RecInput>;
  outlook: {
    direction: string;
    support: string;
    resistance: string;
    outperformers: string[];
    underperformers: string[];
    risks: string[];
    catalysts: string[];
  };
  news: Array<{ title: string; body: string }>;
}

export interface MoverInput {
  company_name: string;
  open_price: string;
  close_price: string;
  change_pct: string;
}

export interface RecInput {
  company_name: string;
  note: string;
}

// ────────────── Helpers ──────────────

function parseNum(s: string): number | null {
  if (s === '' || s === null || s === undefined) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return { year: d.getUTCFullYear(), week };
}

function getCurrentWeekDates(): {
  monday: string;
  friday: string;
  nextMonday: string;
  nextFriday: string;
} {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const nextFriday = new Date(monday);
  nextFriday.setDate(monday.getDate() + 11);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return {
    monday: fmt(monday),
    friday: fmt(friday),
    nextMonday: fmt(nextMonday),
    nextFriday: fmt(nextFriday),
  };
}

// ────────────── Actions ──────────────

/** Create a blank draft, redirect to its editor. */
export async function createBlankDraftAction(): Promise<void> {
  const { userId } = await requireResearchManager();

  const supabase = getSupabaseAdmin();
  const { year, week } = getISOWeek(new Date());
  const { monday, friday, nextMonday, nextFriday } = getCurrentWeekDates();

  const baseSlug = `${year}-W${week.toString().padStart(2, '0')}-draft`;
  const suffix = Date.now().toString(36).slice(-4);
  const slug = `${baseSlug}-${suffix}`;

  const { data, error } = await supabase
    .from('reports')
    .insert({
      slug,
      period_start: monday,
      period_end: friday,
      outlook_period_start: nextMonday,
      outlook_period_end: nextFriday,
      headline: 'New draft report',
      status: 'draft',
      created_by: userId,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create draft: ${error?.message ?? 'unknown'}`);
  }

  revalidatePath('/research/admin/reports');
  redirect(`/research/admin/reports/${data.id}/edit`);
}

export interface SaveResult {
  ok: boolean;
  error: string | null;
  newId?: string;
}

/** Save the entire form state for a report.
 *  Also clears parse_confidence — once you've saved, you've reviewed.
 */
export async function saveReportAction(
  id: string,
  state: ReportFormState
): Promise<SaveResult> {
  try {
    await requireResearchManager();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const supabase = getSupabaseAdmin();

  // 1. Update the report row + clear parse_confidence
  const { error: reportErr } = await supabase
    .from('reports')
    .update({
      slug: state.slug,
      period_start: state.period_start,
      period_end: state.period_end,
      outlook_period_start: state.outlook_period_start,
      outlook_period_end: state.outlook_period_end,
      headline: state.headline,
      parse_confidence: null,
    })
    .eq('id', id);

  if (reportErr) {
    if (reportErr.code === '23505') {
      return { ok: false, error: 'That slug is already in use.' };
    }
    return { ok: false, error: `Save failed: ${reportErr.message}` };
  }

  // 2. Upsert metrics
  const { error: metricsErr } = await supabase.from('report_metrics').upsert(
    {
      report_id: id,
      asi_value: state.metrics.asi_value,
      asi_change_pct: parseNum(state.metrics.asi_change_pct),
      mcap_value: state.metrics.mcap_value,
      mcap_change_pct: parseNum(state.metrics.mcap_change_pct),
      volume_shares: state.metrics.volume_shares || null,
      volume_change_pct: parseNum(state.metrics.volume_change_pct),
      value_traded: state.metrics.value_traded || null,
      value_change_pct: parseNum(state.metrics.value_change_pct),
      deals: state.metrics.deals || null,
      deals_change_pct: parseNum(state.metrics.deals_change_pct),
    },
    { onConflict: 'report_id' }
  );
  if (metricsErr) return { ok: false, error: `Metrics: ${metricsErr.message}` };

  // 3. Movers — delete + reinsert
  await supabase.from('report_movers').delete().eq('report_id', id);
  const moverRows = [
    ...state.gainers
      .filter((g) => g.company_name.trim())
      .map((g, i) => ({
        report_id: id,
        kind: 'gainer' as const,
        rank: i + 1,
        company_name: g.company_name.trim(),
        open_price: parseNum(g.open_price) ?? 0,
        close_price: parseNum(g.close_price) ?? 0,
        change_pct: parseNum(g.change_pct) ?? 0,
      })),
    ...state.decliners
      .filter((d) => d.company_name.trim())
      .map((d, i) => ({
        report_id: id,
        kind: 'decliner' as const,
        rank: i + 1,
        company_name: d.company_name.trim(),
        open_price: parseNum(d.open_price) ?? 0,
        close_price: parseNum(d.close_price) ?? 0,
        change_pct: parseNum(d.change_pct) ?? 0,
      })),
  ];
  if (moverRows.length > 0) {
    const { error: moversErr } = await supabase
      .from('report_movers')
      .insert(moverRows);
    if (moversErr) return { ok: false, error: `Movers: ${moversErr.message}` };
  }

  // 4. Recommendations — delete + reinsert
  await supabase.from('report_recommendations').delete().eq('report_id', id);
  const recRows = [
    ...state.buy
      .filter((r) => r.company_name.trim())
      .map((r, i) => ({
        report_id: id,
        kind: 'buy' as const,
        company_name: r.company_name.trim(),
        note: r.note.trim() || null,
        display_order: i + 1,
      })),
    ...state.hold
      .filter((r) => r.company_name.trim())
      .map((r, i) => ({
        report_id: id,
        kind: 'hold' as const,
        company_name: r.company_name.trim(),
        note: r.note.trim() || null,
        display_order: i + 1,
      })),
    ...state.sell
      .filter((r) => r.company_name.trim())
      .map((r, i) => ({
        report_id: id,
        kind: 'sell' as const,
        company_name: r.company_name.trim(),
        note: r.note.trim() || null,
        display_order: i + 1,
      })),
  ];
  if (recRows.length > 0) {
    const { error: recsErr } = await supabase
      .from('report_recommendations')
      .insert(recRows);
    if (recsErr) return { ok: false, error: `Recs: ${recsErr.message}` };
  }

  // 5. Outlook — upsert
  const { error: outlookErr } = await supabase.from('report_outlook').upsert(
    {
      report_id: id,
      direction: state.outlook.direction,
      support: state.outlook.support || null,
      resistance: state.outlook.resistance || null,
      outperformers: state.outlook.outperformers.filter((s) => s.trim()),
      underperformers: state.outlook.underperformers.filter((s) => s.trim()),
      risks: state.outlook.risks.filter((s) => s.trim()),
      catalysts: state.outlook.catalysts.filter((s) => s.trim()),
    },
    { onConflict: 'report_id' }
  );
  if (outlookErr) return { ok: false, error: `Outlook: ${outlookErr.message}` };

  // 6. News — delete + reinsert
  await supabase.from('report_news').delete().eq('report_id', id);
  const newsRows = state.news
    .filter((n) => n.title.trim() || n.body.trim())
    .map((n, i) => ({
      report_id: id,
      title: n.title.trim(),
      body: n.body.trim(),
      display_order: i + 1,
    }));
  if (newsRows.length > 0) {
    const { error: newsErr } = await supabase
      .from('report_news')
      .insert(newsRows);
    if (newsErr) return { ok: false, error: `News: ${newsErr.message}` };
  }

  // Invalidate the cached rendered PDF — content changed. Best-effort.
  await deleteCachedPdf(id);

  revalidatePath(`/research/admin/reports/${id}/edit`);
  revalidatePath(`/research/admin/reports/${id}/preview`);
  revalidatePath(`/research/admin/reports`);
  revalidatePath(`/research`);
  revalidatePath(`/research/archive`);
  revalidatePath(`/research/${state.slug}`);

  return { ok: true, error: null };
}

export interface PublishResult {
  ok: boolean;
  error: string | null;
}

/** Validate + save + flip status to published. */
export async function publishReportAction(
  id: string,
  state: ReportFormState
): Promise<PublishResult> {
  if (!state.slug.trim()) return { ok: false, error: 'Slug is required.' };
  if (!state.headline.trim()) return { ok: false, error: 'Headline is required.' };
  if (!state.period_start || !state.period_end)
    return { ok: false, error: 'Period dates are required.' };
  if (!state.outlook_period_start || !state.outlook_period_end)
    return { ok: false, error: 'Outlook period dates are required.' };
  if (!state.metrics.asi_value.trim())
    return { ok: false, error: 'NGX ASI value is required.' };
  if (!state.metrics.mcap_value.trim())
    return { ok: false, error: 'Market cap is required.' };
  if (!state.outlook.direction.trim())
    return { ok: false, error: 'Outlook direction is required.' };

  const saveResult = await saveReportAction(id, state);
  if (!saveResult.ok) return { ok: false, error: saveResult.error };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('reports')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/research`);
  revalidatePath(`/research/archive`);
  revalidatePath(`/research/${state.slug}`);
  revalidatePath(`/research/admin/reports`);

  return { ok: true, error: null };
}

/** Revert a published report back to draft. */
export async function unpublishReportAction(id: string): Promise<void> {
  await requireResearchManager();
  const supabase = getSupabaseAdmin();
  await supabase
    .from('reports')
    .update({ status: 'draft', published_at: null })
    .eq('id', id);

  // Invalidate the cached rendered PDF; the public PDF route 404s on drafts
  // anyway, but keep a clean slate for any future re-publish.
  await deleteCachedPdf(id);

  // Auto-cancel any scheduled sends for this report so a paused report can't
  // fire a broadcast that dispatchCampaign would then reject (Phase 2d).
  await cancelJobsForReport(id);

  revalidatePath('/research');
  revalidatePath('/research/archive');
  revalidatePath('/research/admin/reports');
  revalidatePath('/research/admin/scheduled');
}

/** Delete a report and its source PDF. */
export async function deleteReportAction(id: string): Promise<void> {
  await requireResearchManager();
  const supabase = getSupabaseAdmin();

  // Look up source PDF path before deleting the row
  const { data: report } = await supabase
    .from('reports')
    .select('source_pdf_url')
    .eq('id', id)
    .maybeSingle();

  // Delete the report (cascades to related tables)
  await supabase.from('reports').delete().eq('id', id);

  // Best-effort cleanup of the source PDF
  if (report?.source_pdf_url) {
    await deleteReportPdf(report.source_pdf_url);
  }

  // Also clean up any cached rendered PDF
  await deleteCachedPdf(id);

  revalidatePath('/research/admin/reports');
  revalidatePath('/research');
  revalidatePath('/research/archive');
  redirect('/research/admin/reports');
}

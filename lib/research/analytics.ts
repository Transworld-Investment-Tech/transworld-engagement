import { getSupabaseAdmin } from '@/lib/research/supabase';

/**
 * Research send analytics, read from send_log (written at dispatch and updated
 * by the Resend webhook). Ported from the retired portal and rewired to this
 * app's directory: recipients are `contacts` (not `clients`), status counts
 * come from `report_subscriptions`, and every join is done in two steps in JS
 * (row counts are small — hundreds per campaign, a few campaigns a month).
 *
 * A "campaign" is a report that has at least one send_log row; re-sends to the
 * same report aggregate into one campaign, matching the dashboard's Last-campaign
 * card.
 */

export type SendStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'complained';

export interface CampaignSummary {
  report_id: string;
  report_slug: string;
  report_headline: string;
  sent_at: string;
  recipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
}

export interface CampaignRecipient {
  contact_id: string | null;
  contact_name: string;
  contact_email: string;
  status: SendStatus;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  error_message: string | null;
}

export interface ListHealth {
  total_active: number;
  total_pending: number;
  total_unsubscribed: number;
  total_bounced: number;
  open_rate_30d: number;
  click_rate_30d: number;
  bounce_rate_30d: number;
  unsubscribe_rate_30d: number;
  campaigns_30d: number;
}

export interface TrendPoint {
  date: string;
  recipients: number;
  open_rate: number;
  click_rate: number;
}

interface SendLogRow {
  id: string;
  report_id: string;
  contact_id: string | null;
  status: SendStatus;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  error_message: string | null;
}

/** One CampaignSummary per report that has any send_log rows, newest first. */
export async function listCampaigns(): Promise<CampaignSummary[]> {
  const supabase = getSupabaseAdmin();

  const { data: logData, error } = await supabase
    .from('send_log')
    .select(
      'id, report_id, status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at'
    );
  if (error) throw new Error(`listCampaigns: ${error.message}`);
  const rows = (logData ?? []) as SendLogRow[];
  if (rows.length === 0) return [];

  const reportIds = Array.from(new Set(rows.map((r) => r.report_id)));
  const { data: reportData } = await supabase
    .from('reports')
    .select('id, slug, headline')
    .in('id', reportIds);
  const reportById = new Map<string, { slug: string; headline: string }>();
  for (const r of (reportData ?? []) as Array<{
    id: string;
    slug: string;
    headline: string;
  }>) {
    reportById.set(r.id, { slug: r.slug, headline: r.headline });
  }

  const byReport = new Map<string, CampaignSummary>();
  for (const row of rows) {
    const report = reportById.get(row.report_id);
    if (!report) continue; // report deleted (cascade would remove logs; be safe)

    let agg = byReport.get(row.report_id);
    if (!agg) {
      agg = {
        report_id: row.report_id,
        report_slug: report.slug,
        report_headline: report.headline,
        sent_at: row.sent_at ?? new Date().toISOString(),
        recipients: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
        failed: 0,
      };
      byReport.set(row.report_id, agg);
    }
    agg.recipients += 1;
    if (row.delivered_at) agg.delivered += 1;
    if (row.opened_at) agg.opened += 1;
    if (row.clicked_at) agg.clicked += 1;
    if (row.bounced_at) agg.bounced += 1;
    if (row.complained_at) agg.complained += 1;
    if (row.status === 'failed') agg.failed += 1;
    if (row.sent_at && row.sent_at < agg.sent_at) agg.sent_at = row.sent_at;
  }

  return Array.from(byReport.values()).sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
}

export async function getCampaignSummary(reportId: string): Promise<CampaignSummary | null> {
  const all = await listCampaigns();
  return all.find((c) => c.report_id === reportId) ?? null;
}

/** Per-recipient delivery detail for one report's campaign. */
export async function listCampaignRecipients(reportId: string): Promise<CampaignRecipient[]> {
  const supabase = getSupabaseAdmin();

  const { data: logData, error } = await supabase
    .from('send_log')
    .select(
      'contact_id, status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at, error_message'
    )
    .eq('report_id', reportId)
    .order('sent_at', { ascending: false });
  if (error) throw new Error(`listCampaignRecipients: ${error.message}`);
  const rows = (logData ?? []) as Array<Omit<SendLogRow, 'id' | 'report_id'>>;

  const contactIds = Array.from(
    new Set(rows.map((r) => r.contact_id).filter((id): id is string => !!id))
  );
  const contactById = new Map<
    string,
    { title: string | null; first_name: string; last_name: string; email: string | null }
  >();
  if (contactIds.length > 0) {
    const { data: contactData } = await supabase
      .from('contacts')
      .select('id, title, first_name, last_name, email')
      .in('id', contactIds);
    for (const c of (contactData ?? []) as Array<{
      id: string;
      title: string | null;
      first_name: string;
      last_name: string;
      email: string | null;
    }>) {
      contactById.set(c.id, {
        title: c.title,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
      });
    }
  }

  return rows.map((r) => {
    const c = r.contact_id ? contactById.get(r.contact_id) : undefined;
    const name = c
      ? [c.title, c.first_name, c.last_name].filter(Boolean).join(' ')
      : '(removed contact)';
    return {
      contact_id: r.contact_id,
      contact_name: name,
      contact_email: c?.email ?? '',
      status: r.status,
      sent_at: r.sent_at,
      delivered_at: r.delivered_at,
      opened_at: r.opened_at,
      clicked_at: r.clicked_at,
      bounced_at: r.bounced_at,
      complained_at: r.complained_at,
      error_message: r.error_message,
    };
  });
}

export async function getListHealth(): Promise<ListHealth> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Subscription composition by status.
  const { data: subRows } = await supabase.from('report_subscriptions').select('status');
  const counts = { active: 0, pending: 0, unsubscribed: 0, bounced: 0 };
  for (const r of (subRows ?? []) as Array<{ status: string }>) {
    if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
  }

  // 30-day send_log aggregates.
  const { data: logRows } = await supabase
    .from('send_log')
    .select('report_id, opened_at, clicked_at, bounced_at')
    .gte('sent_at', since);
  const total = logRows?.length ?? 0;
  let opened = 0;
  let clicked = 0;
  let bounced = 0;
  const reportIds = new Set<string>();
  for (const r of (logRows ?? []) as Array<{
    report_id: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    bounced_at: string | null;
  }>) {
    if (r.opened_at) opened += 1;
    if (r.clicked_at) clicked += 1;
    if (r.bounced_at) bounced += 1;
    if (r.report_id) reportIds.add(r.report_id);
  }

  // 30-day unsubscribes.
  const { count: unsubCount } = await supabase
    .from('report_subscriptions')
    .select('id', { count: 'exact', head: true })
    .gte('unsubscribed_at', since);

  return {
    total_active: counts.active,
    total_pending: counts.pending,
    total_unsubscribed: counts.unsubscribed,
    total_bounced: counts.bounced,
    open_rate_30d: total ? opened / total : 0,
    click_rate_30d: total ? clicked / total : 0,
    bounce_rate_30d: total ? bounced / total : 0,
    unsubscribe_rate_30d: total ? (unsubCount ?? 0) / total : 0,
    campaigns_30d: reportIds.size,
  };
}

export async function getTrendData(weeks = 12): Promise<TrendPoint[]> {
  const campaigns = await listCampaigns();
  const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
  return campaigns
    .filter((c) => new Date(c.sent_at) >= cutoff)
    .map((c) => ({
      date: c.sent_at.slice(0, 10),
      recipients: c.recipients,
      open_rate: c.recipients ? c.opened / c.recipients : 0,
      click_rate: c.recipients ? c.clicked / c.recipients : 0,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Map of report_id → {sent_at, recipients} for the "Sent" badge on the reports list. */
export async function getSentIndicatorByReportId(): Promise<
  Map<string, { sent_at: string; recipients: number }>
> {
  const campaigns = await listCampaigns();
  const map = new Map<string, { sent_at: string; recipients: number }>();
  for (const c of campaigns) {
    map.set(c.report_id, { sent_at: c.sent_at, recipients: c.recipients });
  }
  return map;
}

import { getSupabaseAdmin } from '@/lib/research/supabase';
import { fetchAdminReportById } from '@/lib/research/reports';
import { renderReportEmail } from '@/lib/research/email/render';
import { sendBatch, type BatchRecipient } from '@/lib/research/email/resend';
import {
  buildReportUrl,
  buildUnsubscribeUrl,
  buildListUnsubscribeHeader,
} from '@/lib/research/email/tokens';
import { CAMPAIGN_HARD_CAP } from '@/lib/research/email/config';

const PLACEHOLDER_UNSUB = '__UNSUBSCRIBE_URL_PLACEHOLDER__';
const PLACEHOLDER_PORTAL = '__PORTAL_URL_PLACEHOLDER__';

export interface DispatchInput {
  reportId: string;
  /** Contact ids selected to receive the report. */
  contactIds: string[];
  subject: string;
  /** Provenance for logging — 'manual' = Send-now button; 'cron' = future worker. */
  triggeredBy: 'manual' | 'cron';
}

export interface DispatchResult {
  sentCount: number;
  failedCount: number;
  totalRecipients: number;
}

interface RecipientRow {
  contactId: string;
  email: string;
  token: string;
}

/**
 * Shared campaign-dispatch logic. Ported from the retired portal and rewired to
 * this app's directory: recipients are the shared `contacts` joined to their
 * active `report_subscriptions` (never `clients`), and each send is tracked in
 * `send_log` by `contact_id`.
 *
 * Only ACTIVE subscriptions are ever mailed — pending, unsubscribed, and
 * bounced are filtered out here even if the caller passed a stale selection.
 * The caller is responsible for auth. Throws on hard failure (report missing,
 * no active recipients) so a future cron worker can surface it on the job row.
 */
export async function dispatchCampaign(
  input: DispatchInput
): Promise<DispatchResult> {
  const { reportId, contactIds, subject } = input;

  if (!reportId || !subject || !Array.isArray(contactIds)) {
    throw new Error('reportId, subject, and contactIds[] are required');
  }
  if (contactIds.length === 0) {
    throw new Error('No recipients selected');
  }
  if (contactIds.length > CAMPAIGN_HARD_CAP) {
    throw new Error(
      `Too many recipients in a single campaign (max ${CAMPAIGN_HARD_CAP})`
    );
  }

  const supabase = getSupabaseAdmin();

  // ─── Report must be published and complete ───
  const adminReport = await fetchAdminReportById(reportId);
  if (!adminReport) throw new Error('Report not found');
  if (adminReport.report.status !== 'published') {
    throw new Error('Only published reports can be sent.');
  }
  if (!adminReport.metrics || !adminReport.outlook) {
    throw new Error('Report is missing required sections (metrics, outlook).');
  }

  // ─── Resolve recipients: active subscriptions among the selected contacts ───
  const { data: subsData, error: subsErr } = await supabase
    .from('report_subscriptions')
    .select('contact_id, unsubscribe_token, status')
    .in('contact_id', contactIds)
    .eq('status', 'active');
  if (subsErr) {
    throw new Error(`Failed to load subscriptions: ${subsErr.message}`);
  }
  const activeSubs = (subsData ?? []) as Array<{
    contact_id: string;
    unsubscribe_token: string;
  }>;
  if (activeSubs.length === 0) {
    throw new Error('None of the selected contacts are active subscribers.');
  }

  // Emails live on contacts; a subscriber with no email can't be mailed.
  const subContactIds = activeSubs.map((s) => s.contact_id);
  const { data: contactsData, error: contactsErr } = await supabase
    .from('contacts')
    .select('id, email')
    .in('id', subContactIds);
  if (contactsErr) {
    throw new Error(`Failed to load contacts: ${contactsErr.message}`);
  }
  const emailById = new Map<string, string>();
  for (const c of (contactsData ?? []) as Array<{ id: string; email: string | null }>) {
    if (c.email) emailById.set(c.id, c.email);
  }

  const recipients: RecipientRow[] = activeSubs
    .map((s) => {
      const email = emailById.get(s.contact_id);
      return email
        ? { contactId: s.contact_id, email, token: s.unsubscribe_token }
        : null;
    })
    .filter((r): r is RecipientRow => r !== null);

  if (recipients.length === 0) {
    throw new Error('No active subscribers with an email address.');
  }

  // ─── Render once with placeholders, then personalize per recipient ───
  const portalUrl = buildReportUrl(adminReport.report.slug);
  const fullReport = {
    report: adminReport.report,
    metrics: adminReport.metrics,
    gainers: adminReport.gainers,
    decliners: adminReport.decliners,
    recommendations: adminReport.recommendations,
    outlook: adminReport.outlook,
    news: adminReport.news,
  };

  const rendered = await renderReportEmail({
    report: fullReport,
    portalUrl: PLACEHOLDER_PORTAL,
    unsubscribeUrl: PLACEHOLDER_UNSUB,
  });
  const templateHtml = rendered.html;
  const templateText = rendered.text;

  // ─── Pre-create send_log rows (status=queued) ───
  const queuedRows = recipients.map((r) => ({
    report_id: reportId,
    contact_id: r.contactId,
    status: 'queued' as const,
    subject,
  }));
  const { error: queueErr } = await supabase.from('send_log').insert(queuedRows);
  if (queueErr) throw new Error(`Failed to queue sends: ${queueErr.message}`);

  // ─── Build per-recipient personalized HTML ───
  const batchRecipients: BatchRecipient[] = recipients.map((r) => {
    const unsubUrl = buildUnsubscribeUrl(r.token);
    return {
      clientId: r.contactId,
      email: r.email,
      html: templateHtml
        .replaceAll(PLACEHOLDER_UNSUB, unsubUrl)
        .replaceAll(PLACEHOLDER_PORTAL, portalUrl),
      text: templateText
        .replaceAll(PLACEHOLDER_UNSUB, unsubUrl)
        .replaceAll(PLACEHOLDER_PORTAL, portalUrl),
      listUnsubscribeHeader: buildListUnsubscribeHeader(r.token),
    };
  });

  // ─── Send ───
  const results = await sendBatch(batchRecipients, subject);

  // ─── Update send_log per recipient ───
  const now = new Date().toISOString();
  let sentCount = 0;
  let failedCount = 0;

  const updates = results.map(async (res) => {
    if (res.ok) sentCount++;
    else failedCount++;

    await supabase
      .from('send_log')
      .update({
        status: res.ok ? 'sent' : 'failed',
        sent_at: res.ok ? now : null,
        resend_id: res.resendId,
        error_message: res.error,
      })
      .eq('report_id', reportId)
      .eq('contact_id', res.clientId)
      .eq('status', 'queued');
  });

  await Promise.all(updates);

  return { sentCount, failedCount, totalRecipients: results.length };
}

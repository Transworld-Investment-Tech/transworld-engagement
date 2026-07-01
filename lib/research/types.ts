export type ReportStatus = 'draft' | 'published';
export type MoverKind = 'gainer' | 'decliner';
export type RecKind = 'buy' | 'hold' | 'sell';
export type ClientTier = 'Standard' | 'Premium';
export type ClientStatus = 'active' | 'pending' | 'unsubscribed' | 'bounced';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ParseConfidence {
  metadata: ConfidenceLevel;
  metrics: ConfidenceLevel;
  gainers: ConfidenceLevel;
  decliners: ConfidenceLevel;
  recommendations: ConfidenceLevel;
  outlook: ConfidenceLevel;
  news: ConfidenceLevel;
}

export interface Report {
  id: string;
  slug: string;
  period_start: string;
  period_end: string;
  outlook_period_start: string;
  outlook_period_end: string;
  headline: string;
  status: ReportStatus;
  source_pdf_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  parse_confidence: ParseConfidence | null;
}

export interface ReportMetrics {
  report_id: string;
  asi_value: string;
  asi_change_pct: number | null;
  mcap_value: string;
  mcap_change_pct: number | null;
  volume_shares: string | null;
  volume_change_pct: number | null;
  value_traded: string | null;
  value_change_pct: number | null;
  deals: string | null;
  deals_change_pct: number | null;
}

export interface ReportMover {
  id: string;
  report_id: string;
  kind: MoverKind;
  rank: number;
  company_name: string;
  open_price: number;
  close_price: number;
  change_pct: number;
}

export interface ReportRecommendation {
  id: string;
  report_id: string;
  kind: RecKind;
  company_name: string;
  note: string | null;
  display_order: number;
}

export interface ReportOutlook {
  report_id: string;
  direction: string;
  support: string | null;
  resistance: string | null;
  outperformers: string[];
  underperformers: string[];
  risks: string[];
  catalysts: string[];
}

export interface ReportNews {
  id: string;
  report_id: string;
  title: string;
  body: string;
  display_order: number;
}

/** Public-facing — requires complete data. */
export interface FullReport {
  report: Report;
  metrics: ReportMetrics;
  gainers: ReportMover[];
  decliners: ReportMover[];
  recommendations: {
    buy: ReportRecommendation[];
    hold: ReportRecommendation[];
    sell: ReportRecommendation[];
  };
  outlook: ReportOutlook;
  news: ReportNews[];
}

/** Admin-facing — allows partial data for drafts. */
export interface AdminReport {
  report: Report;
  metrics: ReportMetrics | null;
  gainers: ReportMover[];
  decliners: ReportMover[];
  recommendations: {
    buy: ReportRecommendation[];
    hold: ReportRecommendation[];
    sell: ReportRecommendation[];
  };
  outlook: ReportOutlook | null;
  news: ReportNews[];
}

export interface ReportSummary {
  report: Report;
  metrics: ReportMetrics | null;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  tier: ClientTier;
  status: ClientStatus;
  created_at: string;
  unsubscribed_at: string | null;
  unsubscribe_token: string;
}

export type SendStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'complained';

export interface SendLog {
  id: string;
  report_id: string;
  client_id: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  status: SendStatus;
  resend_id: string | null;
  scheduled_for: string | null;
  subject: string | null;
  error_message: string | null;
}

// ────────────── v0.5.1: Scheduled sends + analytics ──────────────

export type SendJobStatus =
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface SendJob {
  id: string;
  report_id: string;
  scheduled_for: string;
  status: SendJobStatus;
  selected_client_ids: string[];
  subject: string;
  created_by: string | null;
  processing_started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  recipient_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface DispatchResult {
  sentCount: number;
  failedCount: number;
  totalRecipients: number;
}

export interface DispatchInput {
  reportId: string;
  clientIds: string[];
  subject: string;
  /** Provenance for logging — manual = "Send now" button, cron = scheduled job worker. */
  triggeredBy: 'manual' | 'cron';
}

export interface CampaignSummary {
  report_id: string;
  report_slug: string;
  report_headline: string;
  /** Earliest send_log row for the campaign. */
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
  client_id: string;
  client_name: string;
  client_email: string;
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
  /** All values 0..1 — multiply by 100 for display. */
  open_rate_30d: number;
  click_rate_30d: number;
  bounce_rate_30d: number;
  unsubscribe_rate_30d: number;
  campaigns_30d: number;
}

export interface TrendPoint {
  /** ISO date (YYYY-MM-DD) of the campaign's first send. */
  date: string;
  recipients: number;
  open_rate: number;
  click_rate: number;
}

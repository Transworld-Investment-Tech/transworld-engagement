import { getSupabaseAdmin } from '@/lib/research/supabase';
import type { SendJob } from '@/lib/research/types';

/**
 * Scheduled-send job library (Phase 2d). Ported from the retired portal's
 * lib/jobs.ts and rewired to this app's directory: a job's recipients are
 * `contacts` (via `send_jobs.selected_contact_ids`), never the portal's
 * `clients`/`selected_client_ids`. Report joins are done as an explicit
 * follow-up query + Map stitch (matching reports.ts / subscriptions.ts) rather
 * than a PostgREST embed, so nothing depends on an auto-generated FK name.
 *
 * The worker (app/api/cron/process-sends) claims due jobs and forwards each
 * job's stored selection to the shared dispatchCampaign — it never resolves
 * recipients itself. dispatchCampaign then re-filters that selection down to
 * still-active subscribers, so anyone who unsubscribed or bounced between
 * scheduling and firing is dropped automatically.
 */

/**
 * Atomically claim due jobs via the Postgres function `claim_due_send_jobs`,
 * which uses FOR UPDATE SKIP LOCKED so two concurrent cron runs can't grab the
 * same job.
 */
export async function claimDueJobs(limit = 5): Promise<SendJob[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('claim_due_send_jobs', {
    p_limit: limit,
  });
  if (error) throw new Error(`claimDueJobs: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(normalizeJob);
}

export async function getJob(jobId: string): Promise<SendJob | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('send_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw new Error(`getJob: ${error.message}`);
  return data ? normalizeJob(data) : null;
}

export interface ScheduledJobWithReport extends SendJob {
  report_slug: string;
  report_headline: string;
}

/** Every not-yet-finished job (scheduled + processing), soonest first. */
export async function listScheduledJobs(): Promise<ScheduledJobWithReport[]> {
  const supabase = getSupabaseAdmin();
  const { data: jobRows, error } = await supabase
    .from('send_jobs')
    .select('*')
    .in('status', ['scheduled', 'processing'])
    .order('scheduled_for', { ascending: true });
  if (error) throw new Error(`listScheduledJobs: ${error.message}`);

  const jobs = (jobRows ?? []).map(normalizeJob);
  if (jobs.length === 0) return [];

  const reportIds = Array.from(new Set(jobs.map((j) => j.report_id)));
  const { data: reportRows, error: rErr } = await supabase
    .from('reports')
    .select('id, slug, headline')
    .in('id', reportIds);
  if (rErr) throw new Error(`listScheduledJobs (reports): ${rErr.message}`);

  const byId = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((reportRows ?? []) as any[]).map((r) => [r.id as string, r])
  );
  return jobs.map((j) => {
    const r = byId.get(j.report_id);
    return {
      ...j,
      report_slug: (r?.slug as string) ?? '',
      report_headline: (r?.headline as string) ?? '(report removed)',
    };
  });
}

export interface CreateJobInput {
  reportId: string;
  scheduledFor: Date;
  contactIds: string[];
  subject: string;
  createdBy: string | null;
}

export async function createJob(input: CreateJobInput): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('send_jobs')
    .insert({
      report_id: input.reportId,
      scheduled_for: input.scheduledFor.toISOString(),
      selected_contact_ids: input.contactIds,
      subject: input.subject,
      created_by: input.createdBy,
      recipient_count: input.contactIds.length,
      status: 'scheduled',
    })
    .select('id')
    .single();
  if (error) throw new Error(`createJob: ${error.message}`);
  return data.id as string;
}

export interface UpdateJobInput {
  scheduledFor?: Date;
  contactIds?: string[];
  subject?: string;
}

export async function updateScheduledJob(jobId: string, patch: UpdateJobInput) {
  const supabase = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};
  if (patch.scheduledFor) update.scheduled_for = patch.scheduledFor.toISOString();
  if (patch.contactIds) {
    update.selected_contact_ids = patch.contactIds;
    update.recipient_count = patch.contactIds.length;
  }
  if (patch.subject !== undefined) update.subject = patch.subject;

  const { error } = await supabase
    .from('send_jobs')
    .update(update)
    .eq('id', jobId)
    .eq('status', 'scheduled'); // only jobs that haven't started can be edited
  if (error) throw new Error(`updateScheduledJob: ${error.message}`);
}

export async function completeJob(
  jobId: string,
  result: { sentCount: number; failedCount: number }
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('send_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      success_count: result.sentCount,
      failure_count: result.failedCount,
    })
    .eq('id', jobId);
  if (error) throw new Error(`completeJob: ${error.message}`);
}

export async function failJob(jobId: string, message: string) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from('send_jobs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: message.slice(0, 1000),
    })
    .eq('id', jobId);
}

export async function cancelJob(jobId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('send_jobs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'scheduled'); // only jobs that haven't started can be cancelled
  if (error) throw new Error(`cancelJob: ${error.message}`);
}

/**
 * Auto-cancel any scheduled jobs for a report when it is unpublished. Called
 * from unpublishReportAction so a paused report can't fire a scheduled campaign
 * that would then be rejected by dispatchCampaign's published check.
 */
export async function cancelJobsForReport(reportId: string) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from('send_jobs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
      error_message: 'Report unpublished — scheduled send cancelled automatically.',
    })
    .eq('report_id', reportId)
    .eq('status', 'scheduled');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeJob(row: any): SendJob {
  return {
    ...row,
    selected_contact_ids: Array.isArray(row.selected_contact_ids)
      ? row.selected_contact_ids
      : [],
  } as SendJob;
}

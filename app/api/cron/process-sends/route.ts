import { NextResponse } from 'next/server';
import { claimDueJobs, completeJob, failJob } from '@/lib/research/jobs';
import { dispatchCampaign } from '@/lib/research/email/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // cold start + a large batch; cron runs every 5 min

/**
 * Scheduled-send worker — the one Clement-approved exception to "cron never
 * mails clients." The human gate is upstream: a manager authored, reviewed, and
 * SCHEDULED each broadcast. This worker is dispatch-only — it never composes an
 * email and never resolves recipients on its own. It claims due jobs and hands
 * each job's stored selection to the shared dispatchCampaign, which re-filters
 * to still-active subscribers (so a between-schedule-and-fire unsubscribe or
 * bounce is dropped automatically).
 *
 * Auth: Vercel Cron attaches `Authorization: Bearer <CRON_SECRET>`
 * automatically. Anything else — including a direct browser hit — is rejected.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();

  let jobs;
  try {
    jobs = await claimDueJobs(5);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }

  const results: Array<{
    jobId: string;
    status: 'completed' | 'failed';
    sent?: number;
    failed?: number;
    error?: string;
  }> = [];

  for (const job of jobs) {
    try {
      const result = await dispatchCampaign({
        reportId: job.report_id,
        contactIds: job.selected_contact_ids,
        subject: job.subject,
        triggeredBy: 'cron',
      });
      await completeJob(job.id, result);
      results.push({
        jobId: job.id,
        status: 'completed',
        sent: result.sentCount,
        failed: result.failedCount,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      await failJob(job.id, msg);
      results.push({ jobId: job.id, status: 'failed', error: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    processed: jobs.length,
    results,
  });
}

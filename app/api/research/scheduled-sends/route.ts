import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireResearchManager } from '@/lib/research/auth';
import { getSupabaseAdmin } from '@/lib/research/supabase';
import { createJob } from '@/lib/research/jobs';

export const runtime = 'nodejs';

/**
 * Schedule a research broadcast for a future time (Phase 2d). Manager+, matching
 * the immediate "Send now" route — scheduling is "Send now, but later," the same
 * human action deferred. The recipients passed here are frozen onto the job;
 * the worker later re-filters them to still-active subscribers at fire time.
 */

const CreateSchema = z.object({
  reportId: z.string().min(1),
  contactIds: z.array(z.string().min(1)).min(1),
  subject: z.string().min(1).max(200),
  scheduledFor: z.string().datetime(), // ISO UTC
});

const MIN_LEAD_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  let userId: string;
  try {
    ({ userId } = await requireResearchManager());
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json(
      { ok: false, error: msg },
      { status: msg === 'Not authenticated' ? 401 : 403 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return NextResponse.json(
      { ok: false, error: `Invalid input — ${issues}` },
      { status: 400 }
    );
  }

  const { reportId, contactIds, subject, scheduledFor } = parsed.data;

  const when = new Date(scheduledFor);
  if (when.getTime() - Date.now() < MIN_LEAD_MS) {
    return NextResponse.json(
      { ok: false, error: 'Scheduled time must be at least 10 minutes in the future.' },
      { status: 400 }
    );
  }

  // Confirm the report is published — catches scheduling against a draft.
  const supabase = getSupabaseAdmin();
  const { data: report, error: rErr } = await supabase
    .from('reports')
    .select('id, status')
    .eq('id', reportId)
    .maybeSingle();
  if (rErr) {
    return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ ok: false, error: 'Report not found.' }, { status: 404 });
  }
  if (report.status !== 'published') {
    return NextResponse.json(
      { ok: false, error: 'Publish the report before scheduling a send.' },
      { status: 400 }
    );
  }

  try {
    const jobId = await createJob({
      reportId,
      scheduledFor: when,
      contactIds,
      subject,
      createdBy: userId,
    });
    return NextResponse.json({ ok: true, jobId });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

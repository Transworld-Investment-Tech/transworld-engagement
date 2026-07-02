import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireResearchManager } from '@/lib/research/auth';
import { cancelJob, getJob, updateScheduledJob } from '@/lib/research/jobs';

export const runtime = 'nodejs';

/**
 * Edit or cancel a scheduled send (Phase 2d), manager+. Both operations only
 * apply while the job is still `scheduled`; once the worker has claimed it
 * (`processing`) or it has finished, it can no longer be changed — the routes
 * return 409 in that case, and the job library's `.eq('status','scheduled')`
 * guards are the backstop.
 */

const PatchSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1).optional(),
  subject: z.string().min(1).max(200).optional(),
  scheduledFor: z.string().datetime().optional(),
});

const MIN_LEAD_MS = 10 * 60 * 1000;

async function denyIfNotManager(): Promise<NextResponse | null> {
  try {
    await requireResearchManager();
    return null;
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json(
      { ok: false, error: msg },
      { status: msg === 'Not authenticated' ? 401 : 403 }
    );
  }
}

export async function PATCH(req: Request, ctx: { params: { jobId: string } }) {
  const denied = await denyIfNotManager();
  if (denied) return denied;

  const { jobId } = ctx.params;
  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: 'Scheduled send not found.' }, { status: 404 });
  }
  if (job.status !== 'scheduled') {
    return NextResponse.json(
      { ok: false, error: `This send is ${job.status} and can no longer be edited.` },
      { status: 409 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return NextResponse.json(
      { ok: false, error: `Invalid input — ${issues}` },
      { status: 400 }
    );
  }

  const patch: { contactIds?: string[]; subject?: string; scheduledFor?: Date } = {};
  if (parsed.data.contactIds) patch.contactIds = parsed.data.contactIds;
  if (parsed.data.subject !== undefined) patch.subject = parsed.data.subject;
  if (parsed.data.scheduledFor) {
    const when = new Date(parsed.data.scheduledFor);
    if (when.getTime() - Date.now() < MIN_LEAD_MS) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled time must be at least 10 minutes in the future.' },
        { status: 400 }
      );
    }
    patch.scheduledFor = when;
  }

  try {
    await updateScheduledJob(jobId, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { jobId: string } }) {
  const denied = await denyIfNotManager();
  if (denied) return denied;

  const { jobId } = ctx.params;
  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: 'Scheduled send not found.' }, { status: 404 });
  }
  if (job.status !== 'scheduled') {
    return NextResponse.json(
      { ok: false, error: `This send is ${job.status} and can no longer be cancelled.` },
      { status: 409 }
    );
  }

  try {
    await cancelJob(jobId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

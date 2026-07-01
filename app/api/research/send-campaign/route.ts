import { NextResponse } from 'next/server';
import { getCurrentUser, hasRole } from '@/lib/session';
import { dispatchCampaign } from '@/lib/research/email/dispatch';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Immediate "Send now" endpoint. A human is clicking send, so the firm's
 * "cron never mails clients" rule doesn't apply — no carve-out needed here.
 * Auth + validation live here; the dispatch itself is shared with the future
 * scheduled worker (Phase 2d) via lib/research/email/dispatch.ts.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!hasRole(user, 'manager')) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  }

  let body: { reportId?: string; contactIds?: string[]; subject?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { reportId, contactIds, subject } = body;
  if (!reportId || !subject || !Array.isArray(contactIds)) {
    return NextResponse.json(
      { ok: false, error: 'reportId, subject, and contactIds[] are required' },
      { status: 400 }
    );
  }

  try {
    const result = await dispatchCampaign({
      reportId,
      contactIds,
      subject,
      triggeredBy: 'manual',
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/research/supabase';

export const runtime = 'nodejs';

/**
 * Research unsubscribe. Public and self-securing via the per-contact
 * unsubscribe_token (no session) — the same pattern the signing routes use.
 * Handles both the RFC 8058 List-Unsubscribe-Post one-click (POST) and the
 * link in the email footer's confirmation page (which calls POST). A hard
 * bounce/complaint flipping status to 'bounced' is the Resend webhook's job in
 * Phase 2c; this only handles a human opting out.
 *
 * Research status is its own channel: unsubscribing here never affects the
 * contact's Greetings or Documents.
 */
async function handleUnsubscribe(token: string | null) {
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Missing unsubscribe token' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: sub, error: lookupErr } = await supabase
    .from('report_subscriptions')
    .select('id, status')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (lookupErr || !sub) {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 404 });
  }

  // Idempotent — safe to call repeatedly.
  if (sub.status !== 'unsubscribed') {
    await supabase
      .from('report_subscriptions')
      .update({
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('id', sub.id);
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  return handleUnsubscribe(token);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  return handleUnsubscribe(token);
}

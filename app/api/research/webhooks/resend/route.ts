import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { getSupabaseAdmin } from '@/lib/research/supabase';

export const runtime = 'nodejs';

/**
 * Resend webhook receiver. Records delivery / open / click / bounce / complaint
 * events back to send_log, and applies bounce + complaint policy to the
 * subscriber's research subscription (report_subscriptions) — never to any
 * other channel.
 *
 * Resend signs webhooks with svix; we verify using RESEND_WEBHOOK_SECRET.
 * Unsigned or mis-signed requests are rejected 401.
 *
 * Events:
 *   email.delivered  → send_log.delivered_at + status='delivered'
 *   email.opened     → send_log.opened_at (first open only)
 *   email.clicked    → send_log.clicked_at (first click only)
 *   email.bounced    → send_log.bounced_at + status='bounced'.
 *                      HARD bounce → report_subscriptions.status='bounced'
 *                      (soft bounces are left alone; Resend retries them).
 *   email.complained → send_log.complained_at + status='complained'.
 *                      Auto-unsubscribes the subscriber (research only).
 *   email.failed     → send_log.status='failed'
 *
 * delivery_delayed and unknown types are no-ops. Unknown resend_id returns 200
 * (Resend retries non-2xx; we don't want retries for events on messages we
 * didn't send, e.g. stray test sends).
 */

interface ResendEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    to?: string[] | string;
    from?: string;
    subject?: string;
    bounce?: { type?: string; message?: string; subType?: string };
    click?: { link?: string; timestamp?: string };
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'webhook secret not configured' },
      { status: 500 }
    );
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ ok: false, error: 'missing svix headers' }, { status: 401 });
  }

  const rawBody = await req.text();
  let event: ResendEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendEvent;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const resendId = event.data.email_id;
  if (!resendId) {
    return NextResponse.json({ ok: true, skipped: 'no email_id' });
  }

  const { data: row } = await supabase
    .from('send_log')
    .select('id, contact_id, opened_at, clicked_at')
    .eq('resend_id', resendId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ ok: true, skipped: 'unknown resend_id' });
  }

  const now = new Date().toISOString();

  switch (event.type) {
    case 'email.delivered':
      await supabase
        .from('send_log')
        .update({ delivered_at: now, status: 'delivered' })
        .eq('id', row.id);
      break;

    case 'email.opened':
      if (!row.opened_at) {
        await supabase.from('send_log').update({ opened_at: now }).eq('id', row.id);
      }
      break;

    case 'email.clicked':
      if (!row.clicked_at) {
        await supabase.from('send_log').update({ clicked_at: now }).eq('id', row.id);
      }
      break;

    case 'email.bounced': {
      // Resend/SES report a permanent (hard) bounce as type "Permanent" and a
      // transient (soft) bounce as "Transient". Match case-insensitively, and
      // accept "hard" too, defensively.
      const bounceType = (event.data.bounce?.type ?? '').toLowerCase();
      await supabase
        .from('send_log')
        .update({
          bounced_at: now,
          status: 'bounced',
          error_message: event.data.bounce?.message ?? null,
        })
        .eq('id', row.id);

      // Permanent/hard bounce → stop sending to this subscriber. Transient
      // (soft) bounces are left alone for Resend to retry.
      if ((bounceType === 'permanent' || bounceType === 'hard') && row.contact_id) {
        await supabase
          .from('report_subscriptions')
          .update({ status: 'bounced' })
          .eq('contact_id', row.contact_id);
      }
      break;
    }

    case 'email.complained':
      await supabase
        .from('send_log')
        .update({ complained_at: now, status: 'complained' })
        .eq('id', row.id);
      if (row.contact_id) {
        await supabase
          .from('report_subscriptions')
          .update({ status: 'unsubscribed', unsubscribed_at: now })
          .eq('contact_id', row.contact_id);
      }
      break;

    case 'email.failed':
      await supabase
        .from('send_log')
        .update({ status: 'failed', error_message: 'reported failed by Resend' })
        .eq('id', row.id);
      break;

    default:
      // delivery_delayed and any future event types — no-op
      break;
  }

  return NextResponse.json({ ok: true, type: event.type });
}

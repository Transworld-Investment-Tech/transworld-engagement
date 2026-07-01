/**
 * Research email configuration. All outbound-mail "magic strings" live here.
 * Research sends from investment@ (a watched inbox) as both From and reply-to;
 * Greetings/Documents keep noreply@ via MAIL_FROM. Ported from the retired
 * portal's lib/email/config.ts; only the base-URL source changed (this app uses
 * NEXT_PUBLIC_APP_URL, already set in Vercel).
 */

export const EMAIL_FROM_ADDRESS = 'investment@transworldltd.com.ng';
export const EMAIL_FROM_NAME = 'Transworld Investment & Securities';
export const EMAIL_FROM = `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>`;
export const EMAIL_REPLY_TO = EMAIL_FROM_ADDRESS;

/** Public base URL — used for report links and unsubscribe URLs in emails. */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

/**
 * Resend allows up to 100 emails per batch.send call. We use 50 to leave
 * headroom and to avoid hitting per-call size limits on large recipient lists.
 */
export const BATCH_SIZE = 50;

/** Soft cap on a single campaign — beyond this, we'd want a queue worker. */
export const CAMPAIGN_HARD_CAP = 5000;

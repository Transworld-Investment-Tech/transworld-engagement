import { Resend } from 'resend';
import {
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  BATCH_SIZE,
} from './config';

let _client: Resend | null = null;

function getResendClient(): Resend {
  if (_client) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  _client = new Resend(apiKey);
  return _client;
}

export interface SendOneArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  listUnsubscribeHeader?: string;
}

export interface SendOneResult {
  ok: boolean;
  resendId: string | null;
  error: string | null;
}

/** Send a single email — used for test sends. */
export async function sendOne(args: SendOneArgs): Promise<SendOneResult> {
  const client = getResendClient();

  try {
    const headers: Record<string, string> = {};
    if (args.listUnsubscribeHeader) {
      headers['List-Unsubscribe'] = args.listUnsubscribeHeader;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    const result = await client.emails.send({
      from: EMAIL_FROM,
      to: [args.to],
      replyTo: EMAIL_REPLY_TO,
      subject: args.subject,
      html: args.html,
      text: args.text,
      headers,
    });

    if (result.error) {
      return {
        ok: false,
        resendId: null,
        error: result.error.message ?? 'Unknown Resend error',
      };
    }

    return {
      ok: true,
      resendId: result.data?.id ?? null,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      resendId: null,
      error: (err as Error).message,
    };
  }
}

export interface BatchRecipient {
  /** Stable client id, used to map results back. */
  clientId: string;
  email: string;
  /** Pre-rendered, per-recipient HTML (with unsubscribe URL substituted). */
  html: string;
  /** Pre-rendered, per-recipient text. */
  text: string;
  /** RFC 8058 List-Unsubscribe header value. */
  listUnsubscribeHeader: string;
}

export interface BatchResult {
  clientId: string;
  email: string;
  ok: boolean;
  resendId: string | null;
  error: string | null;
}

/**
 * Send a campaign by batches of up to BATCH_SIZE.
 * Returns one result per recipient — success or failure are recorded
 * independently so partial failures don't block the rest.
 */
export async function sendBatch(
  recipients: BatchRecipient[],
  subject: string
): Promise<BatchResult[]> {
  const client = getResendClient();
  const results: BatchResult[] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const slice = recipients.slice(i, i + BATCH_SIZE);

    try {
      const batchPayload = slice.map((r) => ({
        from: EMAIL_FROM,
        to: [r.email],
        replyTo: EMAIL_REPLY_TO,
        subject,
        html: r.html,
        text: r.text,
        headers: {
          'List-Unsubscribe': r.listUnsubscribeHeader,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }));

      const response = await client.batch.send(batchPayload);

      if (response.error) {
        // Whole batch failed — mark each as failed
        for (const r of slice) {
          results.push({
            clientId: r.clientId,
            email: r.email,
            ok: false,
            resendId: null,
            error: response.error.message ?? 'Batch failed',
          });
        }
        continue;
      }

      // Map back: Resend returns an array of {id} in the same order
      const data = response.data?.data ?? [];
      for (let j = 0; j < slice.length; j++) {
        const r = slice[j];
        const item = data[j];
        if (item && 'id' in item && item.id) {
          results.push({
            clientId: r.clientId,
            email: r.email,
            ok: true,
            resendId: item.id,
            error: null,
          });
        } else {
          results.push({
            clientId: r.clientId,
            email: r.email,
            ok: false,
            resendId: null,
            error: 'No id returned from Resend',
          });
        }
      }
    } catch (err) {
      // Network or unexpected error — mark whole slice as failed
      const message = (err as Error).message;
      for (const r of slice) {
        results.push({
          clientId: r.clientId,
          email: r.email,
          ok: false,
          resendId: null,
          error: message,
        });
      }
    }

    // Small breath between batches to stay polite to Resend's rate limits
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

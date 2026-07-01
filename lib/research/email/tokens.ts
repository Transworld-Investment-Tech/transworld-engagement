import { getAppBaseUrl } from './config';

/**
 * URL builders for research emails. Ported from the portal; paths rebased onto
 * this app: the public report lives at /research/[slug], the unsubscribe
 * confirmation at /research/unsubscribe, and the RFC-8058 one-click POST at
 * /api/research/unsubscribe. The unsubscribe token is stable per-contact and
 * stored on report_subscriptions.
 */

/** Page a subscriber lands on when they click "Unsubscribe" in an email. */
export function buildUnsubscribeUrl(token: string): string {
  return `${getAppBaseUrl()}/research/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** One-click POST URL for the List-Unsubscribe-Post header (native mail buttons). */
export function buildOneClickUnsubscribeUrl(token: string): string {
  return `${getAppBaseUrl()}/api/research/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Public URL for a published report, used as the "View on the web" CTA. */
export function buildReportUrl(slug: string): string {
  return `${getAppBaseUrl()}/research/${encodeURIComponent(slug)}`;
}

/**
 * RFC 8058 List-Unsubscribe header value: a one-click POST endpoint plus a
 * mailto fallback. Improves deliverability and gives Gmail/Apple Mail a native
 * unsubscribe button.
 */
export function buildListUnsubscribeHeader(token: string): string {
  return `<${buildOneClickUnsubscribeUrl(token)}>, <mailto:investment@transworldltd.com.ng?subject=unsubscribe>`;
}

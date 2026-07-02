/**
 * Datetime helpers for scheduling research sends (Phase 2d).
 *
 * The firm operates in Africa/Lagos, which is West Africa Time (WAT) — a fixed
 * UTC+1 offset with no daylight saving. That fixed offset lets us convert
 * between a `datetime-local` input's wall-clock string and a UTC ISO instant
 * without any timezone library: a Lagos wall-clock time is just that same
 * clock reading interpreted at +01:00.
 *
 * Pure module — no server-only imports — so it is safe in client components.
 * `send_jobs.scheduled_for` is stored as a UTC `timestamptz`; the picker and
 * every label speak Lagos time.
 */

/** Fixed WAT offset. Lagos has observed no DST, so this never changes. */
const LAGOS_OFFSET = '+01:00';

/**
 * Convert a `datetime-local` value ("YYYY-MM-DDTHH:mm"), read as Lagos
 * wall-clock time, to a UTC ISO string suitable for POSTing. Returns '' if the
 * input is empty or unparseable.
 */
export function lagosInputToUtcIso(local: string): string {
  if (!local) return '';
  // datetime-local omits seconds; normalize to "...:mm:ss".
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  const d = new Date(`${withSeconds}${LAGOS_OFFSET}`);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/**
 * Convert a UTC ISO instant to the "YYYY-MM-DDTHH:mm" string a
 * `datetime-local` input expects, expressed in Lagos wall-clock time. Used to
 * pre-fill the edit form and to compute the input's `min`.
 */
export function utcIsoToLagosInput(iso: string): string {
  const utc = new Date(iso);
  if (Number.isNaN(utc.getTime())) return '';
  // Lagos wall-clock = UTC instant + 1h, then read the UTC fields.
  const shifted = new Date(utc.getTime() + 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

/** The `datetime-local` value `minutes` from now, in Lagos wall-clock time. */
export function nowPlusMinutesLagosInput(minutes: number): string {
  return utcIsoToLagosInput(new Date(Date.now() + minutes * 60 * 1000).toISOString());
}

/**
 * Human-readable Lagos rendering of a UTC ISO instant, e.g.
 * "Jul 3, 2026, 9:00 AM WAT". Uses Intl with the Africa/Lagos zone.
 */
export function formatLagos(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const s = d.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });
  return `${s} WAT`;
}

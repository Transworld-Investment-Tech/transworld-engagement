import type { ReportMover } from '@/lib/research/types';

/**
 * Resolve a mover's open/close prices for display.
 *
 * NGX rows can arrive with only one price plus the % change (the parser stores
 * a missing price as 0 — see lib/parser/claude.ts). When one price and the
 * change are present, the other is recoverable:
 *
 *   change_pct = (close - open) / open * 100
 *     => close = open  * (1 + change_pct / 100)
 *     => open  = close / (1 + change_pct / 100)
 *
 * Returns the resolved pair plus whether it should be shown:
 *   - both prices present             -> use as-is
 *   - exactly one present + a change  -> compute the missing one
 *   - neither usable                  -> hasPair=false (caller shows % only)
 *
 * The change_pct shown to the reader is always the stored value; this only
 * fills in the missing price (rounded by the caller to 2dp for display).
 */
export function resolveMoverPrices(mover: ReportMover): {
  open: number;
  close: number;
  hasPair: boolean;
} {
  const open = Number(mover.open_price);
  const close = Number(mover.close_price);
  const pct = Number(mover.change_pct);
  const factor = 1 + pct / 100;

  // Both prices present — use as-is.
  if (open !== 0 && close !== 0) {
    return { open, close, hasPair: true };
  }
  // Open present, close missing — compute close.
  if (open !== 0 && close === 0) {
    return { open, close: open * factor, hasPair: true };
  }
  // Close present, open missing — compute open (factor === 0 only at -100%).
  if (close !== 0 && open === 0 && factor !== 0) {
    return { open: close / factor, close, hasPair: true };
  }
  // Neither usable (both 0, or the lone anchor can't reconstruct).
  return { open, close, hasPair: false };
}

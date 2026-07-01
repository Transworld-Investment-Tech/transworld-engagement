import type { TrendPoint } from '@/lib/research/analytics';

const INK = '#0A1F44';
const MUTED = '#3A4A6B';
const GOLD = '#B08940';
const GREEN = '#0F5132';
const LINE = '#E8DFD0';

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

/**
 * Compact send-trends chart, hand-rolled in SVG so the research module doesn't
 * pull a charting library. Bars = recipients per campaign; lines = open rate
 * and click rate (0–100%, right axis). Newest campaigns on the right.
 */
export function TrendsChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div
        className="p-12 text-center"
        style={{ background: 'rgba(255,255,255,0.5)', border: '1px dashed #E8DFD0', borderRadius: 4 }}
      >
        <p className="font-body text-base" style={{ color: MUTED }}>
          No campaigns in this window yet.
        </p>
        <p className="font-body text-sm mt-2" style={{ color: MUTED }}>
          Trends appear once reports have been sent.
        </p>
      </div>
    );
  }

  const W = 720;
  const H = 280;
  const padL = 44;
  const padR = 48;
  const padT = 24;
  const padB = 48;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxRecipients = Math.max(1, ...data.map((d) => d.recipients));
  const n = data.length;
  const slot = innerW / n;
  const barW = Math.min(46, slot * 0.5);

  const centerX = (i: number) => padL + slot * i + slot / 2;
  const barTop = (r: number) => padT + innerH - (r / maxRecipients) * innerH;
  const rateY = (rate: number) => padT + innerH - rate * innerH; // rate 0..1

  const openPts = data.map((d, i) => `${centerX(i)},${rateY(d.open_rate)}`).join(' ');
  const clickPts = data.map((d, i) => `${centerX(i)},${rateY(d.click_rate)}`).join(' ');

  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, borderRadius: 4 }}>
      {/* Legend */}
      <div
        className="flex flex-wrap items-center gap-5 px-6 py-4"
        style={{ borderBottom: `1px solid ${LINE}` }}
      >
        <LegendItem swatch={<span style={{ width: 12, height: 12, background: INK, display: 'inline-block', borderRadius: 2 }} />} label="Recipients" />
        <LegendItem swatch={<span style={{ width: 16, height: 3, background: GREEN, display: 'inline-block', borderRadius: 2 }} />} label="Open rate" />
        <LegendItem swatch={<span style={{ width: 16, height: 3, background: GOLD, display: 'inline-block', borderRadius: 2 }} />} label="Click rate" />
        <span className="font-mono text-xs ml-auto" style={{ color: MUTED }}>
          {n} campaign{n === 1 ? '' : 's'}
        </span>
      </div>

      <div className="px-4 py-5 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 480, display: 'block' }} role="img" aria-label="Send trends">
          {/* gridlines + rate axis (right, 0/50/100%) */}
          {[0, 0.5, 1].map((t) => {
            const y = padT + innerH - t * innerH;
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={LINE} strokeWidth={1} />
                <text x={W - padR + 6} y={y + 3} fontSize={10} fill={MUTED} fontFamily="monospace">
                  {Math.round(t * 100)}%
                </text>
              </g>
            );
          })}
          {/* recipients axis (left: 0 and max) */}
          <text x={padL - 8} y={padT + 3} fontSize={10} fill={MUTED} fontFamily="monospace" textAnchor="end">
            {maxRecipients}
          </text>
          <text x={padL - 8} y={padT + innerH + 3} fontSize={10} fill={MUTED} fontFamily="monospace" textAnchor="end">
            0
          </text>

          {/* recipient bars */}
          {data.map((d, i) => {
            const x = centerX(i) - barW / 2;
            const top = barTop(d.recipients);
            return (
              <rect
                key={`bar-${i}`}
                x={x}
                y={top}
                width={barW}
                height={padT + innerH - top}
                fill={INK}
                opacity={0.12}
                rx={2}
              />
            );
          })}

          {/* rate lines */}
          {n > 1 && <polyline points={openPts} fill="none" stroke={GREEN} strokeWidth={2} />}
          {n > 1 && <polyline points={clickPts} fill="none" stroke={GOLD} strokeWidth={2} />}
          {data.map((d, i) => (
            <g key={`pts-${i}`}>
              <circle cx={centerX(i)} cy={rateY(d.open_rate)} r={3} fill={GREEN} />
              <circle cx={centerX(i)} cy={rateY(d.click_rate)} r={3} fill={GOLD} />
            </g>
          ))}

          {/* x labels */}
          {data.map((d, i) => (
            <text
              key={`lbl-${i}`}
              x={centerX(i)}
              y={H - padB + 20}
              fontSize={10}
              fill={MUTED}
              fontFamily="monospace"
              textAnchor="middle"
            >
              {formatShortDate(d.date)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2">
      {swatch}
      <span className="font-body uppercase text-xs" style={{ color: MUTED, letterSpacing: '0.14em' }}>
        {label}
      </span>
    </span>
  );
}

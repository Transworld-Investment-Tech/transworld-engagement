import { ArrowUpRight, ArrowDownRight, Check, X } from 'lucide-react';
import type { FullReport, ReportMover } from '@/lib/research/types';
import { resolveMoverPrices } from '@/lib/research/movers';

// ────────────── helpers ──────────────

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`;
}

function formatPublishedAt(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatChange(
  pct: number | null | undefined
): { text: string; up: boolean } | null {
  if (pct === null || pct === undefined) return null;
  return {
    text: `${pct >= 0 ? '+' : ''}${Number(pct).toFixed(2)}%`,
    up: pct >= 0,
  };
}

// ────────────── small components ──────────────

function MetricCard({
  label,
  value,
  change,
  sub,
}: {
  label: string;
  value: string;
  change: ReturnType<typeof formatChange>;
  sub?: string;
}) {
  return (
    <div style={{ borderLeft: '2px solid #E8DFD0', paddingLeft: 18 }}>
      <div
        className="font-body uppercase text-xs mb-2"
        style={{ color: '#3A4A6B', letterSpacing: '0.18em' }}
      >
        {label}
      </div>
      <div
        className="font-display num"
        style={{
          fontSize: 32,
          fontWeight: 600,
          color: '#0A1F44',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {change && (
        <div
          className="flex items-center gap-1.5 mt-2 font-mono text-xs num"
          style={{ color: change.up ? '#0F5132' : '#842029' }}
        >
          {change.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {change.text}
          {sub && (
            <span style={{ color: '#3A4A6B', marginLeft: 6 }}>{sub}</span>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({
  children,
  kicker,
}: {
  children: React.ReactNode;
  kicker?: string;
}) {
  return (
    <div className="mb-5">
      {kicker && (
        <div
          className="font-body uppercase text-xs mb-1.5"
          style={{ color: '#B08940', letterSpacing: '0.22em' }}
        >
          {kicker}
        </div>
      )}
      <h2
        className="font-display"
        style={{
          fontSize: 28,
          color: '#0A1F44',
          fontWeight: 600,
          lineHeight: 1.1,
        }}
      >
        {children}
      </h2>
    </div>
  );
}

function MoverRow({ mover, idx }: { mover: ReportMover; idx: number }) {
  const isGainer = mover.kind === 'gainer';
  const { open, close, hasPair } = resolveMoverPrices(mover);
  return (
    <div
      className="grid grid-cols-12 items-center gap-2 py-3 px-3"
      style={{ borderTop: idx === 0 ? 'none' : '1px solid #E8DFD0' }}
    >
      <div
        className="col-span-1 font-mono text-xs num"
        style={{ color: '#3A4A6B' }}
      >
        {String(idx + 1).padStart(2, '0')}
      </div>
      <div
        className="col-span-6 font-body text-sm"
        style={{ color: '#0A1F44', fontWeight: 500 }}
      >
        {mover.company_name}
      </div>
      <div
        className="col-span-2 text-right font-mono text-xs num hidden sm:block"
        style={{ color: '#3A4A6B' }}
      >
        {hasPair ? `${open.toFixed(2)} → ${close.toFixed(2)}` : ''}
      </div>
      <div
        className="col-span-3 text-right font-mono num"
        style={{
          fontSize: 13,
          color: isGainer ? '#0F5132' : '#842029',
          fontWeight: 600,
        }}
      >
        {Number(mover.change_pct) > 0 ? '+' : ''}
        {Number(mover.change_pct).toFixed(2)}%
      </div>
    </div>
  );
}

function RecChip({
  label,
  kind,
}: {
  label: string;
  kind: 'buy' | 'hold' | 'sell';
}) {
  const palette = {
    buy: { bg: '#D1E7DD', fg: '#0F5132', dot: '#0F5132', tag: 'BUY' },
    hold: { bg: '#FFF3CD', fg: '#664D03', dot: '#B08940', tag: 'HOLD' },
    sell: { bg: '#F8D7DA', fg: '#842029', dot: '#842029', tag: 'TRIM' },
  }[kind];
  return (
    <div
      className="flex items-center justify-between py-3 px-4 rounded"
      style={{ background: palette.bg }}
    >
      <div className="flex items-center gap-3">
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: palette.dot,
            display: 'inline-block',
          }}
        />
        <span
          className="font-body text-sm"
          style={{ color: palette.fg, fontWeight: 600 }}
        >
          {label}
        </span>
      </div>
      <span
        className="font-mono"
        style={{
          fontSize: 10,
          color: palette.fg,
          opacity: 0.7,
          letterSpacing: '0.15em',
        }}
      >
        {palette.tag}
      </span>
    </div>
  );
}

// ────────────── main ──────────────

export function Portal({ data }: { data: FullReport }) {
  const { report, metrics, gainers, decliners, recommendations, outlook, news } =
    data;

  const hasAnyMovers = gainers.length > 0 || decliners.length > 0;
  const hasAnyRecs =
    recommendations.buy.length > 0 ||
    recommendations.hold.length > 0 ||
    recommendations.sell.length > 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      {/* Masthead */}
      <div
        className="mb-10 pb-10"
        style={{ borderBottom: '1px solid #E8DFD0' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-4 gap-2">
          <div
            className="font-mono text-xs"
            style={{ color: '#B08940', letterSpacing: '0.3em' }}
          >
            {report.slug.toUpperCase()} · WEEKLY MARKET REPORT
          </div>
          <div className="font-mono text-xs" style={{ color: '#3A4A6B' }}>
            {formatPeriod(report.period_start, report.period_end)}
          </div>
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: 'clamp(32px, 5vw, 56px)',
            lineHeight: 1.05,
            color: '#0A1F44',
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          {report.headline}
        </h1>
        <div
          className="mt-8 font-body text-sm"
          style={{ color: '#3A4A6B' }}
        >
          Prepared by{' '}
          <span style={{ color: '#0A1F44', fontWeight: 600 }}>
            Ezeh Ekpereamaka Daniel
          </span>{' '}
          · Senior Equity Research Analyst
          {report.published_at && (
            <span> · Published {formatPublishedAt(report.published_at)}</span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-16">
        <MetricCard
          label="NGX ASI"
          value={metrics.asi_value}
          change={formatChange(metrics.asi_change_pct)}
        />
        <MetricCard
          label="Market Cap"
          value={metrics.mcap_value}
          change={formatChange(metrics.mcap_change_pct)}
        />
        {metrics.volume_shares && (
          <MetricCard
            label="Volume"
            value={metrics.volume_shares}
            change={formatChange(metrics.volume_change_pct)}
            sub="shares"
          />
        )}
        {metrics.value_traded && (
          <MetricCard
            label="Value Traded"
            value={metrics.value_traded}
            change={formatChange(metrics.value_change_pct)}
          />
        )}
        {metrics.deals && (
          <MetricCard
            label="Deals Executed"
            value={metrics.deals}
            change={formatChange(metrics.deals_change_pct)}
          />
        )}
      </div>

      {/* Movers — only render when at least one side has data */}
      {hasAnyMovers && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {gainers.length > 0 && (
            <div>
              <SectionLabel kicker="Top Gainers">
                Leaders of the week
              </SectionLabel>
              <div style={{ border: '1px solid #E8DFD0', background: 'white' }}>
                {gainers.map((g, i) => (
                  <MoverRow key={g.id} mover={g} idx={i} />
                ))}
              </div>
            </div>
          )}
          {decliners.length > 0 && (
            <div>
              <SectionLabel kicker="Top Decliners">
                Where pressure built
              </SectionLabel>
              <div style={{ border: '1px solid #E8DFD0', background: 'white' }}>
                {decliners.map((d, i) => (
                  <MoverRow key={d.id} mover={d} idx={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {hasAnyRecs && (
        <div className="mb-16">
          <SectionLabel kicker="The Desk's Call">
            Stock recommendations
          </SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendations.buy.length > 0 && (
              <div>
                <div
                  className="font-body uppercase text-xs mb-3"
                  style={{
                    color: '#0F5132',
                    letterSpacing: '0.22em',
                    fontWeight: 600,
                  }}
                >
                  Buy / Accumulate
                </div>
                <div className="space-y-2">
                  {recommendations.buy.map((r) => (
                    <RecChip
                      key={r.id}
                      label={
                        r.note
                          ? `${r.company_name} (${r.note})`
                          : r.company_name
                      }
                      kind="buy"
                    />
                  ))}
                </div>
              </div>
            )}
            {recommendations.hold.length > 0 && (
              <div>
                <div
                  className="font-body uppercase text-xs mb-3"
                  style={{
                    color: '#664D03',
                    letterSpacing: '0.22em',
                    fontWeight: 600,
                  }}
                >
                  Hold
                </div>
                <div className="space-y-2">
                  {recommendations.hold.map((r) => (
                    <RecChip
                      key={r.id}
                      label={
                        r.note
                          ? `${r.company_name} (${r.note})`
                          : r.company_name
                      }
                      kind="hold"
                    />
                  ))}
                </div>
              </div>
            )}
            {recommendations.sell.length > 0 && (
              <div>
                <div
                  className="font-body uppercase text-xs mb-3"
                  style={{
                    color: '#842029',
                    letterSpacing: '0.22em',
                    fontWeight: 600,
                  }}
                >
                  Sell / Trim
                </div>
                <div className="space-y-2">
                  {recommendations.sell.map((r) => (
                    <RecChip
                      key={r.id}
                      label={
                        r.note
                          ? `${r.company_name} (${r.note})`
                          : r.company_name
                      }
                      kind="sell"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Outlook */}
      <div
        className="mb-16 grid grid-cols-1 md:grid-cols-3 gap-10 p-10"
        style={{ background: '#0A1F44', color: '#FAF7F2' }}
      >
        <div>
          <div
            className="font-body uppercase text-xs mb-2"
            style={{ color: '#D4B570', letterSpacing: '0.22em' }}
          >
            Outlook ·{' '}
            {formatPeriod(
              report.outlook_period_start,
              report.outlook_period_end
            )}
          </div>
          <h2
            className="font-display"
            style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.1 }}
          >
            {outlook.direction}
          </h2>
          <div className="mt-6 space-y-3 font-mono text-sm">
            {outlook.resistance && (
              <div className="flex justify-between">
                <span style={{ color: '#D4B570' }}>Resistance</span>
                <span className="num">{outlook.resistance}</span>
              </div>
            )}
            {outlook.support && (
              <div className="flex justify-between">
                <span style={{ color: '#D4B570' }}>Support</span>
                <span className="num">{outlook.support}</span>
              </div>
            )}
          </div>
        </div>
        <div>
          {(outlook.outperformers.length > 0 ||
            outlook.underperformers.length > 0) && (
            <>
              <div
                className="font-body uppercase text-xs mb-3"
                style={{ color: '#D4B570', letterSpacing: '0.22em' }}
              >
                Sectors to watch
              </div>
              {outlook.outperformers.length > 0 && (
                <>
                  <div
                    className="font-body text-sm mb-3"
                    style={{ opacity: 0.65 }}
                  >
                    Outperformers
                  </div>
                  <ul className="space-y-2 mb-5 font-body text-sm">
                    {outlook.outperformers.map((s) => (
                      <li key={s} className="flex items-center gap-2">
                        <Check size={14} style={{ color: '#D4B570' }} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {outlook.underperformers.length > 0 && (
                <>
                  <div
                    className="font-body text-sm mb-3"
                    style={{ opacity: 0.65 }}
                  >
                    Underperformers
                  </div>
                  <ul className="space-y-2 font-body text-sm">
                    {outlook.underperformers.map((s) => (
                      <li key={s} className="flex items-center gap-2">
                        <X size={14} style={{ color: '#D4B570' }} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
        <div>
          {outlook.risks.length > 0 && (
            <>
              <div
                className="font-body uppercase text-xs mb-3"
                style={{ color: '#D4B570', letterSpacing: '0.22em' }}
              >
                Key risks
              </div>
              <ul className="font-body text-sm" style={{ lineHeight: 1.5 }}>
                {outlook.risks.map((r) => (
                  <li
                    key={r}
                    className="flex gap-3 py-3"
                    style={{ borderTop: '1px solid rgba(212,181,112,0.2)' }}
                  >
                    <span
                      className="font-mono"
                      style={{ color: '#D4B570', fontSize: 11 }}
                    >
                      —
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* News */}
      {news.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {news.map((n) => (
            <div
              key={n.id}
              className="p-6"
              style={{ border: '1px solid #E8DFD0', background: 'white' }}
            >
              <div
                className="font-body uppercase text-xs mb-2"
                style={{ color: '#B08940', letterSpacing: '0.22em' }}
              >
                Key Market News
              </div>
              <h3
                className="font-display mb-3"
                style={{ fontSize: 22, color: '#0A1F44', fontWeight: 600 }}
              >
                {n.title}
              </h3>
              <p
                className="font-body text-sm"
                style={{ color: '#3A4A6B', lineHeight: 1.6 }}
              >
                {n.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

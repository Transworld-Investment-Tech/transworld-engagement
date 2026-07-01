import type { FullReport, ReportMover } from '@/lib/research/types';

// ────────────── helpers ──────────────

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`;
}

function formatLongDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatChange(pct: number | null): string | null {
  if (pct === null) return null;
  return `${pct >= 0 ? '+' : ''}${Number(pct).toFixed(2)}%`;
}

function formatNum(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ────────────── styles (inline for puppeteer reliability) ──────────────

const COLORS = {
  navy: '#0A1F44',
  gold: '#B08940',
  goldSoft: '#D4B570',
  paper: '#FAF7F2',
  white: '#FFFFFF',
  ink: '#0A1F44',
  inkSoft: '#3A4A6B',
  line: '#E8DFD0',
  bull: '#0F5132',
  bullSoft: '#D1E7DD',
  bear: '#842029',
  bearSoft: '#F8D7DA',
  hold: '#664D03',
  holdSoft: '#FFF3CD',
};

const PRINT_CSS = `
@page {
  size: A4;
  margin: 0;
}

* {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}

html, body {
  margin: 0;
  padding: 0;
  background: ${COLORS.paper};
  font-family: var(--font-body), system-ui, sans-serif;
  color: ${COLORS.ink};
  -webkit-font-smoothing: antialiased;
}

.pdf-doc {
  width: 210mm;
  margin: 0 auto;
}

.pdf-page {
  width: 210mm;
  min-height: 297mm;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  page-break-after: always;
  break-after: page;
}

.pdf-page:last-child {
  page-break-after: auto;
  break-after: auto;
}

/* ── Cover ── */
.pdf-cover {
  background: ${COLORS.navy};
  color: ${COLORS.paper};
  padding: 24mm 22mm;
  display: flex;
  flex-direction: column;
}

.pdf-cover-mast {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pdf-cover-mast-name {
  font-family: var(--font-display), Georgia, serif;
  font-size: 38pt;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1;
  color: ${COLORS.paper};
}

.pdf-cover-mast-tag {
  font-family: var(--font-mono), monospace;
  font-size: 8.5pt;
  letter-spacing: 0.32em;
  color: ${COLORS.goldSoft};
  text-transform: uppercase;
}

.pdf-cover-rule {
  margin-top: 10mm;
  height: 2px;
  width: 60mm;
  background: ${COLORS.gold};
}

.pdf-cover-kicker {
  margin-top: 30mm;
  font-family: var(--font-mono), monospace;
  font-size: 9pt;
  letter-spacing: 0.32em;
  color: ${COLORS.goldSoft};
  text-transform: uppercase;
}

.pdf-cover-title {
  margin-top: 4mm;
  font-family: var(--font-display), Georgia, serif;
  font-size: 32pt;
  font-weight: 600;
  line-height: 1.05;
  color: ${COLORS.paper};
  letter-spacing: -0.01em;
}

.pdf-cover-period {
  margin-top: 6mm;
  font-family: var(--font-mono), monospace;
  font-size: 11pt;
  color: ${COLORS.goldSoft};
  letter-spacing: 0.08em;
}

.pdf-cover-spacer { flex: 1; }

.pdf-cover-headline {
  font-family: var(--font-display), Georgia, serif;
  font-size: 22pt;
  font-weight: 500;
  line-height: 1.18;
  color: ${COLORS.paper};
  letter-spacing: -0.005em;
  max-width: 150mm;
}

.pdf-cover-byline-block {
  margin-top: 14mm;
  display: flex;
  flex-direction: column;
  gap: 3mm;
}

.pdf-cover-byline {
  font-family: var(--font-body), sans-serif;
  font-size: 10pt;
  color: ${COLORS.paper};
  line-height: 1.5;
}

.pdf-cover-byline strong {
  color: ${COLORS.goldSoft};
  font-weight: 600;
}

.pdf-cover-foot {
  margin-top: 8mm;
  border-top: 1px solid rgba(212,181,112,0.35);
  padding-top: 5mm;
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono), monospace;
  font-size: 8pt;
  letter-spacing: 0.18em;
  color: ${COLORS.goldSoft};
  text-transform: uppercase;
}

/* ── Body wrapper ── */
.pdf-body {
  padding: 14mm 18mm 14mm 18mm;
  background: ${COLORS.paper};
  color: ${COLORS.ink};
}

.pdf-body-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 4mm;
  border-bottom: 1px solid ${COLORS.line};
  margin-bottom: 8mm;
}

.pdf-body-header-mast {
  font-family: var(--font-display), Georgia, serif;
  font-size: 14pt;
  font-weight: 600;
  color: ${COLORS.navy};
  letter-spacing: 0.02em;
}

.pdf-body-header-meta {
  font-family: var(--font-mono), monospace;
  font-size: 8pt;
  letter-spacing: 0.22em;
  color: ${COLORS.inkSoft};
  text-transform: uppercase;
}

/* sections */
.pdf-section {
  break-inside: avoid;
  page-break-inside: avoid;
  margin-bottom: 9mm;
}

.pdf-section-kicker {
  font-family: var(--font-mono), monospace;
  font-size: 8pt;
  letter-spacing: 0.28em;
  color: ${COLORS.gold};
  text-transform: uppercase;
  margin-bottom: 2mm;
}

.pdf-section-title {
  font-family: var(--font-display), Georgia, serif;
  font-size: 16pt;
  font-weight: 600;
  color: ${COLORS.navy};
  margin: 0 0 5mm 0;
  line-height: 1.1;
}

/* ── Metrics grid ── */
.pdf-metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5mm;
}

.pdf-metric {
  border-left: 1.5px solid ${COLORS.line};
  padding-left: 4mm;
}

.pdf-metric-label {
  font-family: var(--font-mono), monospace;
  font-size: 7pt;
  letter-spacing: 0.2em;
  color: ${COLORS.inkSoft};
  text-transform: uppercase;
  margin-bottom: 1.5mm;
}

.pdf-metric-value {
  font-family: var(--font-display), Georgia, serif;
  font-size: 16pt;
  font-weight: 600;
  color: ${COLORS.navy};
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.pdf-metric-change {
  font-family: var(--font-mono), monospace;
  font-size: 8pt;
  margin-top: 1.5mm;
  font-variant-numeric: tabular-nums;
}

/* ── Movers ── */
.pdf-movers-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8mm;
}

.pdf-mover-block-kicker {
  font-family: var(--font-mono), monospace;
  font-size: 8pt;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 3mm;
}

.pdf-mover-row {
  display: grid;
  grid-template-columns: 6mm 1fr auto;
  gap: 3mm;
  padding: 2.4mm 0;
  border-top: 1px solid ${COLORS.line};
  align-items: baseline;
}

.pdf-mover-row:first-child { border-top: none; }

.pdf-mover-rank {
  font-family: var(--font-mono), monospace;
  font-size: 7.5pt;
  color: ${COLORS.inkSoft};
  font-variant-numeric: tabular-nums;
}

.pdf-mover-name {
  font-family: var(--font-body), sans-serif;
  font-size: 9.5pt;
  color: ${COLORS.navy};
  font-weight: 500;
}

.pdf-mover-pct {
  font-family: var(--font-mono), monospace;
  font-size: 9pt;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* ── Recommendations ── */
.pdf-recs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 5mm;
}

.pdf-recs-col-kicker {
  font-family: var(--font-mono), monospace;
  font-size: 8pt;
  letter-spacing: 0.22em;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 3mm;
}

.pdf-rec {
  padding: 2.5mm 3.5mm;
  margin-bottom: 1.8mm;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2mm;
  border-radius: 1.5mm;
}

.pdf-rec-name {
  font-family: var(--font-body), sans-serif;
  font-size: 9pt;
  font-weight: 600;
}

.pdf-rec-tag {
  font-family: var(--font-mono), monospace;
  font-size: 7pt;
  letter-spacing: 0.18em;
  opacity: 0.7;
}

.pdf-rec-note {
  font-family: var(--font-body), sans-serif;
  font-size: 8pt;
  font-weight: 400;
  margin-top: 0.8mm;
  display: block;
  opacity: 0.78;
}

/* ── Outlook block ── */
.pdf-outlook {
  background: ${COLORS.navy};
  color: ${COLORS.paper};
  padding: 8mm 9mm;
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 7mm;
  break-inside: avoid;
  page-break-inside: avoid;
}

.pdf-outlook-kicker {
  font-family: var(--font-mono), monospace;
  font-size: 7.5pt;
  letter-spacing: 0.22em;
  color: ${COLORS.goldSoft};
  text-transform: uppercase;
  margin-bottom: 2mm;
}

.pdf-outlook-direction {
  font-family: var(--font-display), Georgia, serif;
  font-size: 18pt;
  font-weight: 600;
  line-height: 1.1;
  color: ${COLORS.paper};
}

.pdf-outlook-levels {
  margin-top: 5mm;
  font-family: var(--font-mono), monospace;
  font-size: 9pt;
}

.pdf-outlook-level-row {
  display: flex;
  justify-content: space-between;
  padding: 1.5mm 0;
  border-top: 1px solid rgba(212,181,112,0.2);
}

.pdf-outlook-level-row:first-of-type { border-top: none; }

.pdf-outlook-level-key {
  color: ${COLORS.goldSoft};
}

.pdf-outlook-list-label {
  font-family: var(--font-body), sans-serif;
  font-size: 8.5pt;
  opacity: 0.7;
  margin: 3mm 0 2mm 0;
}

.pdf-outlook-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-family: var(--font-body), sans-serif;
  font-size: 9pt;
  line-height: 1.45;
}

.pdf-outlook-list li {
  padding: 1.3mm 0;
  display: flex;
  gap: 2mm;
}

.pdf-outlook-list li::before {
  content: "—";
  color: ${COLORS.goldSoft};
  font-family: var(--font-mono), monospace;
  font-size: 8pt;
}

/* ── News ── */
.pdf-news-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5mm;
}

.pdf-news-card {
  border: 1px solid ${COLORS.line};
  background: ${COLORS.white};
  padding: 4.5mm 5mm;
  break-inside: avoid;
}

.pdf-news-kicker {
  font-family: var(--font-mono), monospace;
  font-size: 7pt;
  letter-spacing: 0.22em;
  color: ${COLORS.gold};
  text-transform: uppercase;
  margin-bottom: 2mm;
}

.pdf-news-title {
  font-family: var(--font-display), Georgia, serif;
  font-size: 12pt;
  font-weight: 600;
  color: ${COLORS.navy};
  margin: 0 0 2mm 0;
  line-height: 1.2;
}

.pdf-news-body {
  font-family: var(--font-body), sans-serif;
  font-size: 8.5pt;
  color: ${COLORS.inkSoft};
  line-height: 1.45;
  margin: 0;
}

/* ── Footer band ── */
.pdf-foot {
  margin-top: 10mm;
  padding-top: 4mm;
  border-top: 1px solid ${COLORS.line};
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono), monospace;
  font-size: 7.5pt;
  letter-spacing: 0.22em;
  color: ${COLORS.inkSoft};
  text-transform: uppercase;
}

/* ── Draft markings ── */
.pdf-draft-banner {
  background: ${COLORS.bear};
  color: ${COLORS.paper};
  padding: 3mm 6mm;
  font-family: var(--font-mono), monospace;
  font-size: 8pt;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 600;
  text-align: center;
}

.pdf-cover-draft {
  position: absolute;
  top: 110mm;
  left: 50%;
  transform: translateX(-50%) rotate(-8deg);
  font-family: var(--font-display), Georgia, serif;
  font-size: 60pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(248, 215, 218, 0.18);
  pointer-events: none;
  white-space: nowrap;
}
`;

// ────────────── small components ──────────────

function MetricCell({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: number | null;
}) {
  const changeStr = formatChange(change);
  const isPositive = (change ?? 0) >= 0;
  return (
    <div className="pdf-metric">
      <div className="pdf-metric-label">{label}</div>
      <div className="pdf-metric-value">{value}</div>
      {changeStr !== null && (
        <div
          className="pdf-metric-change"
          style={{ color: isPositive ? COLORS.bull : COLORS.bear }}
        >
          {isPositive ? '↗' : '↘'} {changeStr}
        </div>
      )}
    </div>
  );
}

function MoverRow({ mover, idx }: { mover: ReportMover; idx: number }) {
  const isGainer = mover.kind === 'gainer';
  return (
    <div className="pdf-mover-row">
      <div className="pdf-mover-rank">
        {String(idx + 1).padStart(2, '0')}
      </div>
      <div className="pdf-mover-name">{mover.company_name}</div>
      <div
        className="pdf-mover-pct"
        style={{ color: isGainer ? COLORS.bull : COLORS.bear }}
      >
        {Number(mover.change_pct) > 0 ? '+' : ''}
        {Number(mover.change_pct).toFixed(2)}%
      </div>
    </div>
  );
}

// ────────────── main ──────────────

export function PrintLayout({
  report: data,
  isDraft = false,
}: {
  report: FullReport;
  isDraft?: boolean;
}) {
  const { report, metrics, gainers, decliners, recommendations, outlook, news } =
    data;

  const periodLabel = formatPeriod(report.period_start, report.period_end);
  const outlookPeriodLabel = formatPeriod(
    report.outlook_period_start,
    report.outlook_period_end
  );
  const issuedDate = formatLongDate(
    report.published_at ?? report.updated_at ?? report.created_at
  );

  const hasAnyMovers = gainers.length > 0 || decliners.length > 0;
  const hasAnyRecs =
    recommendations.buy.length > 0 ||
    recommendations.hold.length > 0 ||
    recommendations.sell.length > 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="pdf-doc">
        {/* ─────────────── Cover ─────────────── */}
        <div className="pdf-page pdf-cover">
          {isDraft && (
            <>
              <div className="pdf-cover-draft">DRAFT</div>
              <div
                className="pdf-draft-banner"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                }}
              >
                DRAFT — INTERNAL PREVIEW — DO NOT DISTRIBUTE
              </div>
            </>
          )}

          <div className="pdf-cover-mast">
            <div className="pdf-cover-mast-name">TRANSWORLD</div>
            <div className="pdf-cover-mast-tag">
              Investment &amp; Securities Limited
            </div>
            <div className="pdf-cover-rule" />
          </div>

          <div className="pdf-cover-kicker">
            {report.slug.toUpperCase()} · NGX Weekly Market Report
          </div>
          <div className="pdf-cover-title">NGX Weekly Market Report</div>
          <div className="pdf-cover-period">{periodLabel}</div>

          <div className="pdf-cover-spacer" />

          <div className="pdf-cover-headline">{report.headline}</div>

          <div className="pdf-cover-byline-block">
            <div className="pdf-cover-byline">
              Prepared by{' '}
              <strong>Ezeh Ekpereamaka Daniel</strong>
            </div>
            <div className="pdf-cover-byline" style={{ opacity: 0.7 }}>
              Senior Equity Research Analyst · Transworld Investment &amp;
              Securities Limited
            </div>
          </div>

          <div className="pdf-cover-foot">
            <span>Issued {issuedDate || '—'}</span>
            <span>transworldltd.com.ng</span>
          </div>
        </div>

        {/* ─────────────── Body ─────────────── */}
        <div className="pdf-page pdf-body">
          {isDraft && (
            <div
              className="pdf-draft-banner"
              style={{ marginBottom: '6mm' }}
            >
              DRAFT — INTERNAL PREVIEW — DO NOT DISTRIBUTE
            </div>
          )}

          <div className="pdf-body-header">
            <div className="pdf-body-header-mast">
              TRANSWORLD <span style={{ color: COLORS.gold }}>·</span>{' '}
              <span
                style={{
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize: '9pt',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: COLORS.inkSoft,
                  fontWeight: 400,
                }}
              >
                Weekly Market Report
              </span>
            </div>
            <div className="pdf-body-header-meta">
              {report.slug} · {periodLabel}
            </div>
          </div>

          {/* Restated headline */}
          <div className="pdf-section">
            <div className="pdf-section-kicker">The Week in Review</div>
            <h2
              className="pdf-section-title"
              style={{ fontSize: '20pt', lineHeight: 1.1 }}
            >
              {report.headline}
            </h2>
          </div>

          {/* Metrics */}
          <div className="pdf-section">
            <div className="pdf-section-kicker">At a glance</div>
            <div className="pdf-metrics">
              <MetricCell
                label="NGX ASI"
                value={metrics.asi_value}
                change={metrics.asi_change_pct}
              />
              <MetricCell
                label="Market Cap"
                value={metrics.mcap_value}
                change={metrics.mcap_change_pct}
              />
              {metrics.volume_shares ? (
                <MetricCell
                  label="Volume"
                  value={metrics.volume_shares}
                  change={metrics.volume_change_pct}
                />
              ) : (
                <div />
              )}
              {metrics.value_traded ? (
                <MetricCell
                  label="Value Traded"
                  value={metrics.value_traded}
                  change={metrics.value_change_pct}
                />
              ) : (
                <div />
              )}
              {metrics.deals ? (
                <MetricCell
                  label="Deals"
                  value={metrics.deals}
                  change={metrics.deals_change_pct}
                />
              ) : (
                <div />
              )}
            </div>
          </div>

          {/* Movers */}
          {hasAnyMovers && (
            <div className="pdf-section">
              <div className="pdf-section-kicker">Top movers</div>
              <div className="pdf-movers-grid">
                {gainers.length > 0 && (
                  <div>
                    <div
                      className="pdf-mover-block-kicker"
                      style={{ color: COLORS.bull }}
                    >
                      Top Gainers
                    </div>
                    <div>
                      {gainers.slice(0, 10).map((g, i) => (
                        <MoverRow key={g.id} mover={g} idx={i} />
                      ))}
                    </div>
                  </div>
                )}
                {decliners.length > 0 && (
                  <div>
                    <div
                      className="pdf-mover-block-kicker"
                      style={{ color: COLORS.bear }}
                    >
                      Top Decliners
                    </div>
                    <div>
                      {decliners.slice(0, 10).map((d, i) => (
                        <MoverRow key={d.id} mover={d} idx={i} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {hasAnyRecs && (
            <div className="pdf-section">
              <div className="pdf-section-kicker">The Desk&apos;s call</div>
              <h3
                className="pdf-section-title"
                style={{ fontSize: '14pt', marginBottom: '4mm' }}
              >
                Stock recommendations
              </h3>
              <div className="pdf-recs-grid">
                {recommendations.buy.length > 0 && (
                  <div>
                    <div
                      className="pdf-recs-col-kicker"
                      style={{ color: COLORS.bull }}
                    >
                      Buy / Accumulate
                    </div>
                    {recommendations.buy.map((r) => (
                      <div
                        key={r.id}
                        className="pdf-rec"
                        style={{
                          background: COLORS.bullSoft,
                          color: COLORS.bull,
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%',
                            alignItems: 'baseline',
                          }}
                        >
                          <span className="pdf-rec-name">
                            {r.company_name}
                          </span>
                          <span className="pdf-rec-tag">BUY</span>
                        </div>
                        {r.note && <span className="pdf-rec-note">{r.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {recommendations.hold.length > 0 && (
                  <div>
                    <div
                      className="pdf-recs-col-kicker"
                      style={{ color: COLORS.hold }}
                    >
                      Hold
                    </div>
                    {recommendations.hold.map((r) => (
                      <div
                        key={r.id}
                        className="pdf-rec"
                        style={{
                          background: COLORS.holdSoft,
                          color: COLORS.hold,
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%',
                            alignItems: 'baseline',
                          }}
                        >
                          <span className="pdf-rec-name">
                            {r.company_name}
                          </span>
                          <span className="pdf-rec-tag">HOLD</span>
                        </div>
                        {r.note && <span className="pdf-rec-note">{r.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {recommendations.sell.length > 0 && (
                  <div>
                    <div
                      className="pdf-recs-col-kicker"
                      style={{ color: COLORS.bear }}
                    >
                      Sell / Trim
                    </div>
                    {recommendations.sell.map((r) => (
                      <div
                        key={r.id}
                        className="pdf-rec"
                        style={{
                          background: COLORS.bearSoft,
                          color: COLORS.bear,
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%',
                            alignItems: 'baseline',
                          }}
                        >
                          <span className="pdf-rec-name">
                            {r.company_name}
                          </span>
                          <span className="pdf-rec-tag">TRIM</span>
                        </div>
                        {r.note && <span className="pdf-rec-note">{r.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Outlook */}
          <div className="pdf-section">
            <div className="pdf-outlook">
              <div>
                <div className="pdf-outlook-kicker">
                  Outlook · {outlookPeriodLabel}
                </div>
                <div className="pdf-outlook-direction">{outlook.direction}</div>
                {(outlook.support || outlook.resistance) && (
                  <div className="pdf-outlook-levels">
                    {outlook.resistance && (
                      <div className="pdf-outlook-level-row">
                        <span className="pdf-outlook-level-key">Resistance</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {outlook.resistance}
                        </span>
                      </div>
                    )}
                    {outlook.support && (
                      <div className="pdf-outlook-level-row">
                        <span className="pdf-outlook-level-key">Support</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {outlook.support}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                {(outlook.outperformers.length > 0 ||
                  outlook.underperformers.length > 0) && (
                  <>
                    <div className="pdf-outlook-kicker">Sectors to watch</div>
                    {outlook.outperformers.length > 0 && (
                      <>
                        <div className="pdf-outlook-list-label">
                          Outperformers
                        </div>
                        <ul className="pdf-outlook-list">
                          {outlook.outperformers.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {outlook.underperformers.length > 0 && (
                      <>
                        <div className="pdf-outlook-list-label">
                          Underperformers
                        </div>
                        <ul className="pdf-outlook-list">
                          {outlook.underperformers.map((s) => (
                            <li key={s}>{s}</li>
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
                    <div className="pdf-outlook-kicker">Key risks</div>
                    <ul className="pdf-outlook-list">
                      {outlook.risks.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* News */}
          {news.length > 0 && (
            <div className="pdf-section">
              <div className="pdf-section-kicker">Key market news</div>
              <div className="pdf-news-grid">
                {news.map((n) => (
                  <div key={n.id} className="pdf-news-card">
                    <div className="pdf-news-kicker">News</div>
                    <h4 className="pdf-news-title">{n.title}</h4>
                    <p className="pdf-news-body">{n.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pdf-foot">
            <span>
              {isDraft ? 'Draft preview' : 'Issued'}{' '}
              {issuedDate || '—'}
            </span>
            <span>transworldltd.com.ng</span>
          </div>
        </div>
      </div>
    </>
  );
}

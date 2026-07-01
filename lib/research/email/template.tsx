import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import type {
  FullReport,
  ReportMover,
  ReportRecommendation,
} from '@/lib/research/types';
import { resolveMoverPrices } from '@/lib/research/movers';

const colors = {
  navy: '#0A1F44',
  gold: '#B08940',
  cream: '#FAF7F2',
  paper: '#FFFFFF',
  inkSoft: '#3A4A6B',
  line: '#E8DFD0',
  bull: '#0F5132',
  bear: '#842029',
  hold: '#664D03',
};

const fonts = {
  serif: '"Georgia", "Times New Roman", serif',
  sans: '"Helvetica Neue", "Helvetica", "Arial", sans-serif',
  mono: '"Courier New", "Courier", monospace',
};

interface ReportEmailProps {
  report: FullReport;
  portalUrl: string;
  unsubscribeUrl: string;
  preheader?: string;
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`;
}

function formatNum(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Derive the PDF download URL from the per-recipient portal URL.
 *  Returns null if portalUrl can't be parsed (defensive — empty string etc).
 */
function derivePdfUrl(portalUrl: string, slug: string): string | null {
  try {
    const u = new URL(portalUrl);
    return `${u.origin}/api/reports/${encodeURIComponent(slug)}/pdf`;
  } catch {
    return null;
  }
}

function MetricBlock({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: number | null;
}) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <div>
      <Text
        style={{
          color: colors.inkSoft,
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: '0.18em',
          margin: 0,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.navy,
          fontFamily: fonts.serif,
          fontSize: 24,
          fontWeight: 600,
          margin: '4px 0 0 0',
          lineHeight: 1.1,
        }}
      >
        {value}
      </Text>
      {change !== null && (
        <Text
          style={{
            color: isPositive ? colors.bull : colors.bear,
            fontFamily: fonts.mono,
            fontSize: 12,
            margin: '4px 0 0 0',
          }}
        >
          {isPositive ? '↗' : '↘'} {isPositive ? '+' : ''}
          {change.toFixed(2)}%
        </Text>
      )}
    </div>
  );
}

function MoverRow({
  mover,
  positive,
}: {
  mover: ReportMover;
  positive: boolean;
}) {
  const { open, close, hasPair } = resolveMoverPrices(mover);
  return (
    <div
      style={{
        padding: '10px 0',
        borderBottom: `1px solid ${colors.line}`,
      }}
    >
      <Row>
        <Column>
          <Text
            style={{
              color: colors.navy,
              fontFamily: fonts.serif,
              fontSize: 13,
              fontWeight: 600,
              margin: 0,
            }}
          >
            {mover.company_name}
          </Text>
          {hasPair && (
            <Text
              style={{
                color: colors.inkSoft,
                fontFamily: fonts.mono,
                fontSize: 11,
                margin: '2px 0 0 0',
              }}
            >
              {formatNum(open)} → {formatNum(close)}
            </Text>
          )}
        </Column>
        <Column align="right" style={{ verticalAlign: 'top' }}>
          <Text
            style={{
              color: positive ? colors.bull : colors.bear,
              fontFamily: fonts.mono,
              fontSize: 13,
              fontWeight: 600,
              margin: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {positive ? '+' : ''}
            {mover.change_pct.toFixed(2)}%
          </Text>
        </Column>
      </Row>
    </div>
  );
}

function RecsBlock({
  label,
  color,
  recs,
}: {
  label: string;
  color: string;
  recs: ReportRecommendation[];
}) {
  if (recs.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <Text
        style={{
          color,
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: '0.22em',
          margin: '0 0 8px 0',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        {label}
      </Text>
      {recs.map((r) => (
        <div
          key={r.id}
          style={{
            padding: '8px 12px',
            background: colors.cream,
            borderLeft: `3px solid ${color}`,
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              color: colors.navy,
              fontFamily: fonts.serif,
              fontSize: 14,
              fontWeight: 600,
              margin: 0,
            }}
          >
            {r.company_name}
          </Text>
          {r.note && (
            <Text
              style={{
                color: colors.inkSoft,
                fontFamily: fonts.sans,
                fontSize: 12,
                margin: '2px 0 0 0',
              }}
            >
              {r.note}
            </Text>
          )}
        </div>
      ))}
    </div>
  );
}

function BulletList({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <Text
        style={{
          color: colors.gold,
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: '0.22em',
          margin: '0 0 6px 0',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      {items.map((item, i) => (
        <Text
          key={i}
          style={{
            color: colors.navy,
            fontFamily: fonts.sans,
            fontSize: 13,
            margin: '4px 0',
            paddingLeft: 16,
            position: 'relative',
            lineHeight: 1.5,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 0,
              color: colors.gold,
            }}
          >
            ·
          </span>
          {item}
        </Text>
      ))}
    </div>
  );
}

export function ReportEmail({
  report,
  portalUrl,
  unsubscribeUrl,
  preheader,
}: ReportEmailProps) {
  const { report: r, metrics, gainers, decliners, recommendations, outlook } =
    report;

  const periodLabel = formatPeriod(r.period_start, r.period_end);
  const previewText =
    preheader ?? `${periodLabel} · ${r.headline.slice(0, 100)}`;

  // v0.5.2: Derive the PDF download URL from the portal URL, so the email
  // includes a one-click PDF link alongside the main "Read on portal" CTA.
  const pdfUrl = derivePdfUrl(portalUrl, r.slug);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          background: colors.cream,
          fontFamily: fonts.sans,
          margin: 0,
          padding: 0,
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <Container
          style={{
            maxWidth: 600,
            margin: '0 auto',
            padding: 0,
          }}
        >
          {/* ────── Navy header ────── */}
          <Section style={{ background: colors.navy, padding: '24px 32px' }}>
            <Row>
              <Column>
                <Text
                  style={{
                    color: colors.gold,
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    letterSpacing: '0.22em',
                    margin: 0,
                    textTransform: 'uppercase',
                  }}
                >
                  Transworld
                </Text>
                <Text
                  style={{
                    color: colors.cream,
                    fontFamily: fonts.serif,
                    fontSize: 18,
                    margin: '2px 0 0 0',
                    fontWeight: 600,
                  }}
                >
                  Weekly Market Report
                </Text>
              </Column>
              <Column align="right" style={{ verticalAlign: 'top' }}>
                <Text
                  style={{
                    color: colors.gold,
                    fontFamily: fonts.mono,
                    fontSize: 11,
                    margin: '6px 0 0 0',
                  }}
                >
                  {periodLabel}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* ────── Hero ────── */}
          <Section
            style={{ background: colors.paper, padding: '40px 32px 24px' }}
          >
            <Text
              style={{
                color: colors.gold,
                fontFamily: fonts.mono,
                fontSize: 11,
                letterSpacing: '0.22em',
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              {r.slug}
            </Text>
            <Heading
              as="h1"
              style={{
                fontFamily: fonts.serif,
                fontSize: 28,
                fontWeight: 600,
                color: colors.navy,
                margin: '10px 0 0 0',
                lineHeight: 1.15,
              }}
            >
              {r.headline}
            </Heading>
          </Section>

          {/* ────── Metrics ────── */}
          <Section
            style={{ background: colors.paper, padding: '0 32px 24px' }}
          >
            <Hr
              style={{
                borderColor: colors.line,
                borderTop: `1px solid ${colors.line}`,
                margin: '0 0 24px 0',
              }}
            />
            <Row>
              <Column
                style={{
                  width: '50%',
                  paddingRight: 12,
                  paddingBottom: 16,
                  verticalAlign: 'top',
                }}
              >
                <MetricBlock
                  label="NGX ASI"
                  value={metrics.asi_value}
                  change={metrics.asi_change_pct}
                />
              </Column>
              <Column
                style={{
                  width: '50%',
                  paddingLeft: 12,
                  paddingBottom: 16,
                  verticalAlign: 'top',
                }}
              >
                <MetricBlock
                  label="Market Cap"
                  value={metrics.mcap_value}
                  change={metrics.mcap_change_pct}
                />
              </Column>
            </Row>
            {(metrics.volume_shares || metrics.value_traded) && (
              <Row>
                <Column
                  style={{
                    width: '50%',
                    paddingRight: 12,
                    verticalAlign: 'top',
                  }}
                >
                  <MetricBlock
                    label="Volume"
                    value={metrics.volume_shares ?? '—'}
                    change={metrics.volume_change_pct}
                  />
                </Column>
                <Column
                  style={{
                    width: '50%',
                    paddingLeft: 12,
                    verticalAlign: 'top',
                  }}
                >
                  <MetricBlock
                    label="Value Traded"
                    value={metrics.value_traded ?? '—'}
                    change={metrics.value_change_pct}
                  />
                </Column>
              </Row>
            )}
          </Section>

          {/* ────── Top movers ────── */}
          {(gainers.length > 0 || decliners.length > 0) && (
            <Section
              style={{ background: colors.paper, padding: '0 32px 24px' }}
            >
              <Hr
                style={{
                  borderColor: colors.line,
                  borderTop: `1px solid ${colors.line}`,
                  margin: '0 0 24px 0',
                }}
              />
              <Row>
                <Column
                  style={{
                    verticalAlign: 'top',
                    width: '50%',
                    paddingRight: 12,
                  }}
                >
                  <Text
                    style={{
                      color: colors.bull,
                      fontFamily: fonts.mono,
                      fontSize: 10,
                      letterSpacing: '0.22em',
                      margin: '0 0 4px 0',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    Top Gainers
                  </Text>
                  {gainers.slice(0, 5).map((g) => (
                    <MoverRow key={g.id} mover={g} positive />
                  ))}
                </Column>
                <Column
                  style={{
                    verticalAlign: 'top',
                    width: '50%',
                    paddingLeft: 12,
                  }}
                >
                  <Text
                    style={{
                      color: colors.bear,
                      fontFamily: fonts.mono,
                      fontSize: 10,
                      letterSpacing: '0.22em',
                      margin: '0 0 4px 0',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    Top Decliners
                  </Text>
                  {decliners.slice(0, 5).map((d) => (
                    <MoverRow key={d.id} mover={d} positive={false} />
                  ))}
                </Column>
              </Row>
            </Section>
          )}

          {/* ────── Recommendations ────── */}
          {(recommendations.buy.length > 0 ||
            recommendations.hold.length > 0 ||
            recommendations.sell.length > 0) && (
            <Section
              style={{ background: colors.paper, padding: '0 32px 24px' }}
            >
              <Hr
                style={{
                  borderColor: colors.line,
                  borderTop: `1px solid ${colors.line}`,
                  margin: '0 0 24px 0',
                }}
              />
              <Text
                style={{
                  color: colors.gold,
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                The Desk&apos;s Call
              </Text>
              <Heading
                as="h2"
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 20,
                  fontWeight: 600,
                  color: colors.navy,
                  margin: '8px 0 16px 0',
                }}
              >
                Recommendations
              </Heading>
              <RecsBlock
                label="Buy / Accumulate"
                color={colors.bull}
                recs={recommendations.buy}
              />
              <RecsBlock
                label="Hold"
                color={colors.hold}
                recs={recommendations.hold}
              />
              <RecsBlock
                label="Sell / Trim"
                color={colors.bear}
                recs={recommendations.sell}
              />
            </Section>
          )}

          {/* ────── Outlook ────── */}
          <Section
            style={{ background: colors.paper, padding: '0 32px 24px' }}
          >
            <Hr
              style={{
                borderColor: colors.line,
                borderTop: `1px solid ${colors.line}`,
                margin: '0 0 24px 0',
              }}
            />
            <Text
              style={{
                color: colors.gold,
                fontFamily: fonts.mono,
                fontSize: 11,
                letterSpacing: '0.22em',
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              Outlook
            </Text>
            <Heading
              as="h2"
              style={{
                fontFamily: fonts.serif,
                fontSize: 20,
                fontWeight: 600,
                color: colors.navy,
                margin: '8px 0 4px 0',
              }}
            >
              {outlook.direction}
            </Heading>
            {(outlook.support || outlook.resistance) && (
              <Text
                style={{
                  color: colors.inkSoft,
                  fontFamily: fonts.mono,
                  fontSize: 12,
                  margin: '8px 0',
                }}
              >
                {outlook.support && `Support ${outlook.support}`}
                {outlook.support && outlook.resistance && '   ·   '}
                {outlook.resistance && `Resistance ${outlook.resistance}`}
              </Text>
            )}
            <BulletList
              label="Watch for"
              items={outlook.catalysts.slice(0, 4)}
            />
            <BulletList label="Key risks" items={outlook.risks.slice(0, 4)} />
          </Section>

          {/* ────── CTA ────── */}
          <Section
            style={{
              background: colors.paper,
              padding: '24px 32px 40px',
              textAlign: 'center' as const,
            }}
          >
            <Hr
              style={{
                borderColor: colors.line,
                borderTop: `1px solid ${colors.line}`,
                margin: '0 0 24px 0',
              }}
            />
            <Button
              href={portalUrl}
              style={{
                background: colors.navy,
                color: colors.cream,
                fontFamily: fonts.sans,
                fontSize: 14,
                fontWeight: 500,
                padding: '14px 32px',
                borderRadius: 999,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Read the full report on the portal →
            </Button>
            {pdfUrl && (
              <Text
                style={{
                  color: colors.inkSoft,
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  margin: '14px 0 0 0',
                }}
              >
                Or{' '}
                <Link
                  href={pdfUrl}
                  style={{
                    color: colors.gold,
                    textDecoration: 'underline',
                    fontWeight: 500,
                  }}
                >
                  download the PDF
                </Link>
                {' '}for offline reading.
              </Text>
            )}
            <Text
              style={{
                color: colors.inkSoft,
                fontFamily: fonts.mono,
                fontSize: 11,
                margin: '16px 0 0 0',
                letterSpacing: '0.05em',
              }}
            >
              Full mover tables and previous weeks&apos; archives are on the
              portal.
            </Text>
          </Section>

          {/* ────── Footer ────── */}
          <Section style={{ background: colors.cream, padding: '24px 32px' }}>
            <Hr
              style={{
                borderColor: colors.line,
                borderTop: `1px solid ${colors.line}`,
                margin: '0 0 16px 0',
              }}
            />
            <Text
              style={{
                color: colors.navy,
                fontFamily: fonts.serif,
                fontSize: 14,
                fontWeight: 600,
                margin: 0,
              }}
            >
              Prepared by Ezeh Ekpereamaka Daniel
            </Text>
            <Text
              style={{
                color: colors.inkSoft,
                fontFamily: fonts.mono,
                fontSize: 11,
                margin: '2px 0 0 0',
              }}
            >
              Senior Equity Research Analyst · Transworld Investment &amp;
              Securities Limited
            </Text>
            <Text
              style={{
                color: colors.inkSoft,
                fontFamily: fonts.sans,
                fontSize: 12,
                margin: '20px 0 0 0',
                lineHeight: 1.5,
              }}
            >
              You&apos;re receiving this because you&apos;re on Transworld
              Investment &amp; Securities&apos; research distribution list.
            </Text>
            <Text
              style={{
                color: colors.inkSoft,
                fontFamily: fonts.sans,
                fontSize: 12,
                margin: '6px 0 0 0',
              }}
            >
              <Link
                href={unsubscribeUrl}
                style={{
                  color: colors.gold,
                  textDecoration: 'underline',
                }}
              >
                Unsubscribe
              </Link>
              {'   ·   '}
              <Link
                href={portalUrl}
                style={{
                  color: colors.gold,
                  textDecoration: 'underline',
                }}
              >
                View on portal
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

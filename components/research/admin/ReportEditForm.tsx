'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Save,
  Send,
  Eye,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import {
  saveReportAction,
  publishReportAction,
  unpublishReportAction,
  type ReportFormState,
  type MoverInput,
  type RecInput,
} from '@/app/research/admin/reports/actions';
import type { ReportStatus, ParseConfidence, ConfidenceLevel } from '@/lib/research/types';
import { ConfidenceIndicator } from './ConfidenceIndicator';

const labelStyle = {
  color: '#3A4A6B',
  letterSpacing: '0.18em',
} as const;

const inputStyle = {
  border: '1px solid #E8DFD0',
  background: '#FAF7F2',
  color: '#0A1F44',
} as const;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-body uppercase text-xs mb-1.5" style={labelStyle}>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded font-body text-sm focus:outline-none"
      style={inputStyle}
    />
  );
}

function Textarea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded font-body text-sm focus:outline-none"
      style={inputStyle}
    />
  );
}

function SectionHeader({
  kicker,
  title,
  confidence,
}: {
  kicker: string;
  title: string;
  confidence?: ConfidenceLevel | null;
}) {
  return (
    <div className="mb-5 mt-12">
      <div
        className="font-body uppercase text-xs mb-1.5"
        style={{ color: '#B08940', letterSpacing: '0.22em' }}
      >
        {kicker}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <h2
          className="font-display"
          style={{
            fontSize: 26,
            color: '#0A1F44',
            fontWeight: 600,
            lineHeight: 1.1,
          }}
        >
          {title}
        </h2>
        <ConfidenceIndicator level={confidence} />
      </div>
    </div>
  );
}

function StringListEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={v}
            onChange={(newV) => {
              const next = [...values];
              next[i] = newV;
              onChange(next);
            }}
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, idx) => idx !== i))}
            className="p-2 rounded transition hover:opacity-60"
            style={{ color: '#842029' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, ''])}
        className="font-mono text-xs flex items-center gap-1 transition hover:opacity-70"
        style={{ color: '#3A4A6B' }}
      >
        <Plus size={12} /> Add item
      </button>
    </div>
  );
}

interface ReportEditFormProps {
  reportId: string;
  initialState: ReportFormState;
  status: ReportStatus;
  publishedAt: string | null;
  sourcePdfUrl: string | null;
  parseConfidence: ParseConfidence | null;
}

const blankMover: MoverInput = {
  company_name: '',
  open_price: '',
  close_price: '',
  change_pct: '',
};
const blankRec: RecInput = { company_name: '', note: '' };

export function ReportEditForm({
  reportId,
  initialState,
  status: initialStatus,
  publishedAt,
  sourcePdfUrl,
  parseConfidence,
}: ReportEditFormProps) {
  const router = useRouter();
  const [state, setState] = useState<ReportFormState>(initialState);
  const [status, setStatus] = useState<ReportStatus>(initialStatus);
  const [confidence, setConfidence] = useState<ParseConfidence | null>(
    parseConfidence
  );
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error';
    msg: string;
  } | null>(null);

  const update = (changes: Partial<ReportFormState>) =>
    setState((s) => ({ ...s, ...changes }));
  const updateMetrics = (changes: Partial<ReportFormState['metrics']>) =>
    setState((s) => ({ ...s, metrics: { ...s.metrics, ...changes } }));
  const updateOutlook = (changes: Partial<ReportFormState['outlook']>) =>
    setState((s) => ({ ...s, outlook: { ...s.outlook, ...changes } }));

  const handleSave = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await saveReportAction(reportId, state);
      if (result.ok) {
        setFeedback({ kind: 'success', msg: 'Draft saved.' });
        setConfidence(null);
        router.refresh();
      } else {
        setFeedback({ kind: 'error', msg: result.error ?? 'Save failed.' });
      }
    });
  };

  const handlePublish = () => {
    if (
      status === 'published' &&
      !confirm('Republish this report? It is already live.')
    )
      return;
    if (
      status === 'draft' &&
      !confirm('Publish this report to the public portal?')
    )
      return;
    setFeedback(null);
    startTransition(async () => {
      const result = await publishReportAction(reportId, state);
      if (result.ok) {
        setStatus('published');
        setConfidence(null);
        setFeedback({
          kind: 'success',
          msg: 'Published. The report is now live on the public research site.',
        });
        router.refresh();
      } else {
        setFeedback({
          kind: 'error',
          msg: result.error ?? 'Publish failed.',
        });
      }
    });
  };

  const handleUnpublish = () => {
    if (!confirm('Revert to draft? It will disappear from the public portal.'))
      return;
    setFeedback(null);
    startTransition(async () => {
      await unpublishReportAction(reportId);
      setStatus('draft');
      setFeedback({ kind: 'success', msg: 'Reverted to draft.' });
      router.refresh();
    });
  };

  const hasAnyConfidence = confidence !== null;

  return (
    <div className="pb-24">
      <div
        className="sticky top-0 z-10 -mx-6 px-6 py-4 mb-4 flex flex-wrap items-center justify-between gap-3"
        style={{ background: '#FAF7F2', borderBottom: '1px solid #E8DFD0' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-xs px-2 py-1 rounded"
            style={{
              background: status === 'published' ? '#D1E7DD' : '#FFF3CD',
              color: status === 'published' ? '#0F5132' : '#664D03',
              letterSpacing: '0.1em',
            }}
          >
            {status.toUpperCase()}
          </span>
          <span
            className="font-display"
            style={{ fontSize: 18, color: '#0A1F44', fontWeight: 600 }}
          >
            {state.slug || 'Untitled'}
          </span>
          {publishedAt && (
            <span className="font-mono text-xs" style={{ color: '#3A4A6B' }}>
              · published{' '}
              {new Date(publishedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {sourcePdfUrl && (
            <span
              className="font-mono text-xs flex items-center gap-1.5 px-2 py-1 rounded"
              style={{
                background: 'rgba(176, 137, 64, 0.1)',
                color: '#B08940',
              }}
              title="Source PDF stored — original is preserved for reference"
            >
              <FileText size={11} />
              source attached
            </span>
          )}
          <Link
            href={`/research/admin/reports/${reportId}/preview`}
            target="_blank"
            className="px-3 py-2 rounded-full font-body text-sm flex items-center gap-1.5 transition hover:bg-white"
            style={{
              border: '1px solid #E8DFD0',
              color: '#0A1F44',
              textDecoration: 'none',
            }}
          >
            <Eye size={13} /> Preview
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="px-3 py-2 rounded-full font-body text-sm flex items-center gap-1.5 transition hover:bg-white disabled:opacity-60"
            style={{ border: '1px solid #E8DFD0', color: '#0A1F44' }}
          >
            <Save size={13} /> {pending ? 'Saving…' : 'Save draft'}
          </button>
          {status === 'published' ? (
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={pending}
              className="px-3 py-2 rounded-full font-body text-sm flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-60"
              style={{ background: '#842029', color: '#FAF7F2' }}
            >
              Revert to draft
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={pending}
              className="px-4 py-2 rounded-full font-body text-sm flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-60"
              style={{
                background: '#0F5132',
                color: '#FAF7F2',
                fontWeight: 500,
              }}
            >
              <Send size={13} /> Publish
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className="mb-6 px-4 py-3 rounded font-body text-sm flex items-center gap-2"
          style={{
            background: feedback.kind === 'success' ? '#D1E7DD' : '#F8D7DA',
            color: feedback.kind === 'success' ? '#0F5132' : '#842029',
            border: `1px solid ${feedback.kind === 'success' ? '#a3cfbb' : '#f1aeb5'}`,
          }}
        >
          {feedback.kind === 'success' ? (
            <CheckCircle2 size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          {feedback.msg}
        </div>
      )}

      {hasAnyConfidence && (
        <div
          className="mb-2 px-4 py-3 rounded font-body text-sm flex items-start gap-3"
          style={{
            background: 'rgba(176, 137, 64, 0.08)',
            border: '1px solid rgba(176, 137, 64, 0.3)',
            color: '#664D03',
          }}
        >
          <FileText size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <strong>Pre-filled from PDF.</strong> Review each section — the
            confidence dot tells you how sure Claude was. Sections marked{' '}
            <em>verify</em> or <em>review carefully</em> are most likely to
            need correction. Saving (or publishing) clears the dots.
          </div>
        </div>
      )}

      <SectionHeader
        kicker="Section 1"
        title="Metadata"
        confidence={confidence?.metadata}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <Label>Slug · YYYY-W##</Label>
          <Input
            value={state.slug}
            onChange={(v) => update({ slug: v })}
            placeholder="2026-W19"
          />
        </div>
        <div className="md:col-span-2">
          <Label>Headline</Label>
          <Input
            value={state.headline}
            onChange={(v) => update({ headline: v })}
            placeholder="The week's editorial headline"
          />
        </div>
        <div>
          <Label>Period start</Label>
          <Input
            type="date"
            value={state.period_start}
            onChange={(v) => update({ period_start: v })}
          />
        </div>
        <div>
          <Label>Period end</Label>
          <Input
            type="date"
            value={state.period_end}
            onChange={(v) => update({ period_end: v })}
          />
        </div>
        <div />
        <div>
          <Label>Outlook period start</Label>
          <Input
            type="date"
            value={state.outlook_period_start}
            onChange={(v) => update({ outlook_period_start: v })}
          />
        </div>
        <div>
          <Label>Outlook period end</Label>
          <Input
            type="date"
            value={state.outlook_period_end}
            onChange={(v) => update({ outlook_period_end: v })}
          />
        </div>
      </div>

      <SectionHeader
        kicker="Section 2"
        title="Headline metrics"
        confidence={confidence?.metrics}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {(
          [
            ['NGX ASI', 'asi_value', 'asi_change_pct', '242,277.81'],
            ['Market cap', 'mcap_value', 'mcap_change_pct', '₦155.99T'],
            ['Volume', 'volume_shares', 'volume_change_pct', '4.84B'],
            ['Value traded', 'value_traded', 'value_change_pct', '₦287.76B'],
            ['Deals', 'deals', 'deals_change_pct', '332,453'],
          ] as const
        ).map(([label, valueKey, pctKey, ph]) => (
          <div
            key={valueKey}
            className="p-4"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E8DFD0',
              borderRadius: 4,
            }}
          >
            <Label>{label}</Label>
            <Input
              value={state.metrics[valueKey]}
              onChange={(v) => updateMetrics({ [valueKey]: v })}
              placeholder={ph}
            />
            <div className="mt-2">
              <Label>Change %</Label>
              <Input
                type="number"
                value={state.metrics[pctKey]}
                onChange={(v) => updateMetrics({ [pctKey]: v })}
                placeholder="7.33"
              />
            </div>
          </div>
        ))}
      </div>

      <SectionHeader kicker="Section 3" title="Top movers" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MoversBlock
          title="Top gainers"
          confidence={confidence?.gainers}
          movers={state.gainers}
          onChange={(g) => update({ gainers: g })}
        />
        <MoversBlock
          title="Top decliners"
          confidence={confidence?.decliners}
          movers={state.decliners}
          onChange={(d) => update({ decliners: d })}
        />
      </div>

      <SectionHeader
        kicker="Section 4"
        title="The desk's call"
        confidence={confidence?.recommendations}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RecsBlock
          title="Buy / Accumulate"
          color="#0F5132"
          recs={state.buy}
          onChange={(b) => update({ buy: b })}
        />
        <RecsBlock
          title="Hold"
          color="#664D03"
          recs={state.hold}
          onChange={(h) => update({ hold: h })}
        />
        <RecsBlock
          title="Sell / Trim"
          color="#842029"
          recs={state.sell}
          onChange={(s) => update({ sell: s })}
        />
      </div>

      <SectionHeader
        kicker="Section 5"
        title="Outlook"
        confidence={confidence?.outlook}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <Label>Direction</Label>
          <Input
            value={state.outlook.direction}
            onChange={(v) => updateOutlook({ direction: v })}
            placeholder="Bullish but volatile"
          />
        </div>
        <div>
          <Label>Resistance</Label>
          <Input
            value={state.outlook.resistance}
            onChange={(v) => updateOutlook({ resistance: v })}
            placeholder="250,000"
          />
        </div>
        <div>
          <Label>Support</Label>
          <Input
            value={state.outlook.support}
            onChange={(v) => updateOutlook({ support: v })}
            placeholder="235,000"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label>Outperforming sectors</Label>
          <StringListEditor
            values={state.outlook.outperformers}
            onChange={(v) => updateOutlook({ outperformers: v })}
            placeholder="Industrial Goods (Cement)"
          />
        </div>
        <div>
          <Label>Underperforming sectors</Label>
          <StringListEditor
            values={state.outlook.underperformers}
            onChange={(v) => updateOutlook({ underperformers: v })}
            placeholder="Banking (short term)"
          />
        </div>
        <div>
          <Label>Key risks</Label>
          <StringListEditor
            values={state.outlook.risks}
            onChange={(v) => updateOutlook({ risks: v })}
            placeholder="Profit-taking after strong rally"
          />
        </div>
        <div>
          <Label>Catalysts</Label>
          <StringListEditor
            values={state.outlook.catalysts}
            onChange={(v) => updateOutlook({ catalysts: v })}
            placeholder="Q1 2026 earnings releases"
          />
        </div>
      </div>

      <SectionHeader
        kicker="Section 6"
        title="Key market news"
        confidence={confidence?.news}
      />
      <div className="space-y-4">
        {state.news.map((n, i) => (
          <div
            key={i}
            className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E8DFD0',
              borderRadius: 4,
            }}
          >
            <div className="md:col-span-3">
              <Label>Title</Label>
              <Input
                value={n.title}
                onChange={(v) => {
                  const next = [...state.news];
                  next[i] = { ...next[i], title: v };
                  update({ news: next });
                }}
                placeholder="Rights Issue Activated"
              />
            </div>
            <div className="md:col-span-8">
              <Label>Body</Label>
              <Textarea
                value={n.body}
                onChange={(v) => {
                  const next = [...state.news];
                  next[i] = { ...next[i], body: v };
                  update({ news: next });
                }}
                placeholder="Full text of the news item…"
                rows={2}
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <button
                type="button"
                onClick={() => {
                  update({ news: state.news.filter((_, idx) => idx !== i) });
                }}
                className="p-2 rounded transition hover:opacity-60"
                style={{ color: '#842029' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            update({ news: [...state.news, { title: '', body: '' }] })
          }
          className="font-mono text-xs flex items-center gap-1 transition hover:opacity-70"
          style={{ color: '#3A4A6B' }}
        >
          <Plus size={12} /> Add news item
        </button>
      </div>
    </div>
  );
}

function MoversBlock({
  title,
  confidence,
  movers,
  onChange,
}: {
  title: string;
  confidence?: ConfidenceLevel | null;
  movers: MoverInput[];
  onChange: (m: MoverInput[]) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3
          className="font-display"
          style={{ fontSize: 18, color: '#0A1F44', fontWeight: 600 }}
        >
          {title}
        </h3>
        <ConfidenceIndicator level={confidence} />
      </div>
      <div
        className="overflow-hidden"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8DFD0',
          borderRadius: 4,
        }}
      >
        <div
          className="grid grid-cols-12 gap-2 px-3 py-2 font-body uppercase text-xs"
          style={{
            color: '#3A4A6B',
            letterSpacing: '0.18em',
            borderBottom: '1px solid #E8DFD0',
          }}
        >
          <div className="col-span-1">#</div>
          <div className="col-span-5">Company</div>
          <div className="col-span-2">Open</div>
          <div className="col-span-2">Close</div>
          <div className="col-span-1">%</div>
          <div className="col-span-1"></div>
        </div>
        {movers.map((m, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 px-3 py-2 items-center"
            style={{ borderTop: i === 0 ? 'none' : '1px solid #E8DFD0' }}
          >
            <div
              className="col-span-1 font-mono text-xs"
              style={{ color: '#3A4A6B' }}
            >
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="col-span-5">
              <Input
                value={m.company_name}
                onChange={(v) => {
                  const next = [...movers];
                  next[i] = { ...next[i], company_name: v };
                  onChange(next);
                }}
                placeholder="Company name"
              />
            </div>
            <div className="col-span-2">
              <Input
                type="number"
                value={m.open_price}
                onChange={(v) => {
                  const next = [...movers];
                  next[i] = { ...next[i], open_price: v };
                  onChange(next);
                }}
              />
            </div>
            <div className="col-span-2">
              <Input
                type="number"
                value={m.close_price}
                onChange={(v) => {
                  const next = [...movers];
                  next[i] = { ...next[i], close_price: v };
                  onChange(next);
                }}
              />
            </div>
            <div className="col-span-1">
              <Input
                type="number"
                value={m.change_pct}
                onChange={(v) => {
                  const next = [...movers];
                  next[i] = { ...next[i], change_pct: v };
                  onChange(next);
                }}
              />
            </div>
            <div className="col-span-1 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  onChange(movers.filter((_, idx) => idx !== i))
                }
                className="p-1 rounded transition hover:opacity-60"
                style={{ color: '#842029' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        <div className="px-3 py-2" style={{ borderTop: '1px solid #E8DFD0' }}>
          <button
            type="button"
            onClick={() => onChange([...movers, blankMover])}
            className="font-mono text-xs flex items-center gap-1 transition hover:opacity-70"
            style={{ color: '#3A4A6B' }}
          >
            <Plus size={12} /> Add row
          </button>
        </div>
      </div>
    </div>
  );
}

function RecsBlock({
  title,
  color,
  recs,
  onChange,
}: {
  title: string;
  color: string;
  recs: RecInput[];
  onChange: (r: RecInput[]) => void;
}) {
  return (
    <div>
      <div
        className="font-body uppercase text-xs mb-3"
        style={{ color, letterSpacing: '0.22em', fontWeight: 600 }}
      >
        {title}
      </div>
      <div className="space-y-2">
        {recs.map((r, i) => (
          <div
            key={i}
            className="p-3 grid grid-cols-12 gap-2 items-center"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E8DFD0',
              borderRadius: 4,
            }}
          >
            <div className="col-span-7">
              <Input
                value={r.company_name}
                onChange={(v) => {
                  const next = [...recs];
                  next[i] = { ...next[i], company_name: v };
                  onChange(next);
                }}
                placeholder="Company"
              />
            </div>
            <div className="col-span-4">
              <Input
                value={r.note}
                onChange={(v) => {
                  const next = [...recs];
                  next[i] = { ...next[i], note: v };
                  onChange(next);
                }}
                placeholder="Note (optional)"
              />
            </div>
            <div className="col-span-1 flex justify-end">
              <button
                type="button"
                onClick={() => onChange(recs.filter((_, idx) => idx !== i))}
                className="p-1 rounded transition hover:opacity-60"
                style={{ color: '#842029' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...recs, blankRec])}
          className="font-mono text-xs flex items-center gap-1 transition hover:opacity-70"
          style={{ color: '#3A4A6B' }}
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

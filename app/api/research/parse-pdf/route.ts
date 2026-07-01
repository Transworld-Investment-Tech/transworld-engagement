import { NextResponse } from 'next/server';
import { getResearchUser, isResearchManager } from '@/lib/research/auth';
import { getSupabaseAdmin } from '@/lib/research/supabase';
import { uploadReportPdf, deleteReportPdf } from '@/lib/research/storage';
import { parseReportPdf } from '@/lib/research/parser/claude';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request: Request) {
  // ────── Auth: Engagement session, manager+ ──────
  const user = await getResearchUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }
  if (!(await isResearchManager())) {
    return NextResponse.json(
      { ok: false, error: 'Not authorized' },
      { status: 403 }
    );
  }

  const supabase = getSupabaseAdmin();

  // ────── Parse multipart upload ──────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid form data' },
      { status: 400 }
    );
  }

  const file = formData.get('pdf');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: 'No PDF file provided' },
      { status: 400 }
    );
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { ok: false, error: 'File must be a PDF' },
      { status: 400 }
    );
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'PDF must be under 20 MB' },
      { status: 400 }
    );
  }

  // ────── Read bytes ──────
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');

  // ────── Parse with Claude FIRST so we have the slug ──────
  let parsed;
  try {
    parsed = await parseReportPdf(base64);
  } catch (err) {
    const e = err as Error;
    console.error('[parse-pdf] Parse failed:', e.message);
    return NextResponse.json(
      { ok: false, error: `Parse failed: ${e.message}` },
      { status: 500 }
    );
  }

  // ────── Upload to storage using parsed slug as path prefix ──────
  let storagePath: string;
  try {
    storagePath = await uploadReportPdf(parsed.slug, buffer);
  } catch (err) {
    const e = err as Error;
    console.error('[parse-pdf] Upload failed:', e.message);
    return NextResponse.json(
      { ok: false, error: `Upload failed: ${e.message}` },
      { status: 500 }
    );
  }

  // ────── Create the draft report ──────
  // Always append a short suffix to draft slug to avoid collisions
  const draftSlug = `${parsed.slug}-draft-${Date.now().toString(36).slice(-4)}`;

  const { data: report, error: insertErr } = await supabase
    .from('reports')
    .insert({
      slug: draftSlug,
      period_start: parsed.period_start,
      period_end: parsed.period_end,
      outlook_period_start: parsed.outlook_period_start,
      outlook_period_end: parsed.outlook_period_end,
      headline: parsed.headline,
      status: 'draft',
      source_pdf_url: storagePath,
      created_by: user.id,
      parse_confidence: parsed.confidence,
    })
    .select()
    .single();

  if (insertErr || !report) {
    // Clean up the orphan PDF
    await deleteReportPdf(storagePath);
    return NextResponse.json(
      { ok: false, error: `DB insert failed: ${insertErr?.message ?? 'unknown'}` },
      { status: 500 }
    );
  }

  // ────── Insert metrics ──────
  await supabase.from('report_metrics').insert({
    report_id: report.id,
    asi_value: parsed.metrics.asi_value,
    asi_change_pct: parsed.metrics.asi_change_pct,
    mcap_value: parsed.metrics.mcap_value,
    mcap_change_pct: parsed.metrics.mcap_change_pct,
    volume_shares: parsed.metrics.volume_shares,
    volume_change_pct: parsed.metrics.volume_change_pct,
    value_traded: parsed.metrics.value_traded,
    value_change_pct: parsed.metrics.value_change_pct,
    deals: parsed.metrics.deals,
    deals_change_pct: parsed.metrics.deals_change_pct,
  });

  // ────── Insert movers ──────
  const moverRows = [
    ...parsed.gainers.map((g) => ({
      report_id: report.id,
      kind: 'gainer' as const,
      rank: g.rank,
      company_name: g.company_name,
      open_price: g.open_price,
      close_price: g.close_price,
      change_pct: g.change_pct,
    })),
    ...parsed.decliners.map((d) => ({
      report_id: report.id,
      kind: 'decliner' as const,
      rank: d.rank,
      company_name: d.company_name,
      open_price: d.open_price,
      close_price: d.close_price,
      change_pct: d.change_pct,
    })),
  ];
  if (moverRows.length > 0) {
    await supabase.from('report_movers').insert(moverRows);
  }

  // ────── Insert recommendations ──────
  const recRows = [
    ...parsed.recommendations.buy.map((r, i) => ({
      report_id: report.id,
      kind: 'buy' as const,
      company_name: r.company_name,
      note: r.note,
      display_order: i + 1,
    })),
    ...parsed.recommendations.hold.map((r, i) => ({
      report_id: report.id,
      kind: 'hold' as const,
      company_name: r.company_name,
      note: r.note,
      display_order: i + 1,
    })),
    ...parsed.recommendations.sell.map((r, i) => ({
      report_id: report.id,
      kind: 'sell' as const,
      company_name: r.company_name,
      note: r.note,
      display_order: i + 1,
    })),
  ];
  if (recRows.length > 0) {
    await supabase.from('report_recommendations').insert(recRows);
  }

  // ────── Insert outlook ──────
  await supabase.from('report_outlook').insert({
    report_id: report.id,
    direction: parsed.outlook.direction,
    support: parsed.outlook.support,
    resistance: parsed.outlook.resistance,
    outperformers: parsed.outlook.outperformers,
    underperformers: parsed.outlook.underperformers,
    risks: parsed.outlook.risks,
    catalysts: parsed.outlook.catalysts,
  });

  // ────── Insert news ──────
  if (parsed.news.length > 0) {
    const newsRows = parsed.news.map((n, i) => ({
      report_id: report.id,
      title: n.title,
      body: n.body,
      display_order: i + 1,
    }));
    await supabase.from('report_news').insert(newsRows);
  }

  return NextResponse.json({
    ok: true,
    reportId: report.id,
    slug: report.slug,
    confidence: parsed.confidence,
  });
}

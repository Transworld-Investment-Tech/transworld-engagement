import { NextResponse } from 'next/server';
import { getResearchUser, isResearchManager } from '@/lib/research/auth';
import { getSupabaseAdmin } from '@/lib/research/supabase';
import { renderReportPdf } from '@/lib/research/pdf/render';
import { buildPdfFilename } from '@/lib/research/pdf/filename';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

/**
 * Manager+ PDF download endpoint. Always renders fresh (no cache) so the
 * analyst sees their latest edits. Renders drafts with a DRAFT watermark.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  // ── Auth: Engagement session, manager+ ──
  const user = await getResearchUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!(await isResearchManager())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // ── Lookup ──
  const { id } = params;
  const { data: report } = await supabase
    .from('reports')
    .select('id, slug, status')
    .eq('id', id)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // ── Render ──
  let buffer: Buffer;
  try {
    buffer = await renderReportPdf({
      slug: report.slug,
      isDraft: report.status === 'draft',
    });
  } catch (err) {
    console.error('[pdf:admin] render failed:', err);
    return NextResponse.json({ error: 'PDF render failed' }, { status: 500 });
  }

  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${buildPdfFilename(
        report.slug
      )}"`,
      'Cache-Control': 'no-store',
    },
  });
}

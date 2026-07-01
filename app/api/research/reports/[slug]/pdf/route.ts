import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/research/supabase';
import {
  getCachedPdfInfo,
  getCachedPdfBuffer,
  uploadCachedPdf,
} from '@/lib/research/storage-rendered';
import { renderReportPdf } from '@/lib/research/pdf/render';
import { buildPdfFilename } from '@/lib/research/pdf/filename';

// PDF render can take 15–25s on a Vercel cold start (Puppeteer + Chromium boot).
// 60s ceiling buys headroom without breaking the bank.
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { slug: string };
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = params;

  // Look up the report — published only.
  const supabase = getSupabaseServerClient();
  const { data: report, error } = await supabase
    .from('reports')
    .select('id, slug, updated_at, status')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // Check cache: serve from bucket if it's at least as fresh as the report row.
  let buffer: Buffer | null = null;
  try {
    const info = await getCachedPdfInfo(report.id);
    const fresh =
      info &&
      new Date(info.updatedAt).getTime() >=
        new Date(report.updated_at).getTime();
    if (fresh) {
      buffer = await getCachedPdfBuffer(report.id);
    }
  } catch (err) {
    // Cache failures are non-fatal — fall through to render.
    console.error('[pdf:public] cache lookup failed:', err);
  }

  // Render fresh if we don't have a buffer yet.
  if (!buffer) {
    try {
      buffer = await renderReportPdf({ slug: report.slug, isDraft: false });
    } catch (err) {
      console.error('[pdf:public] render failed:', err);
      return NextResponse.json({ error: 'PDF render failed' }, { status: 500 });
    }

    // Best-effort cache upload — fire and forget. Don't block the response.
    uploadCachedPdf(report.id, buffer).catch((err) =>
      console.error('[pdf:public] cache upload failed:', err)
    );
  }

  // Convert Buffer → Uint8Array so NextResponse's BodyInit typing is happy.
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${buildPdfFilename(
        report.slug
      )}"`,
      // Allow the browser to serve a re-click from its cache for 5 min, but
      // never share across users.
      'Cache-Control': 'private, max-age=300',
    },
  });
}

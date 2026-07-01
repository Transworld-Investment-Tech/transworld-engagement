import { getSupabaseAdmin } from './supabase';

/**
 * Cache bucket for rendered (downloadable) PDFs.
 * Distinct from `report-pdfs` (which holds source PDFs uploaded by the analyst).
 *
 * Keyed by report ID so cache survives slug changes.
 */
const BUCKET = 'report-pdfs-rendered';

/**
 * Inspect cache metadata without downloading. Returns null when the cached
 * PDF doesn't exist yet (first render).
 */
export async function getCachedPdfInfo(
  reportId: string
): Promise<{ updatedAt: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list('', { search: `${reportId}.pdf`, limit: 10 });

  if (error || !data) return null;

  const file = data.find((f) => f.name === `${reportId}.pdf`);
  if (!file) return null;

  // Storage timestamps are ISO strings; fall back through created_at if updated_at missing.
  const updatedAt =
    file.updated_at ?? file.created_at ?? new Date(0).toISOString();
  return { updatedAt };
}

/**
 * Download the cached PDF as a Buffer. Returns null if missing or on error.
 */
export async function getCachedPdfBuffer(
  reportId: string
): Promise<Buffer | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`${reportId}.pdf`);

  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Upload (or overwrite) a cached PDF. Best-effort — caller should not block
 * on failures; logs internally.
 */
export async function uploadCachedPdf(
  reportId: string,
  buffer: Buffer
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${reportId}.pdf`, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    console.error('[storage-rendered] upload failed:', error.message);
  }
}

/**
 * Delete a cached PDF — invoked on save / publish / unpublish to invalidate
 * the cache. Best-effort; logs but does not throw.
 */
export async function deleteCachedPdf(reportId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([`${reportId}.pdf`]);

  if (error) {
    // It's normal for the file to not exist (first save before any render).
    // Only surface non-NotFound errors.
    if (!error.message?.toLowerCase().includes('not found')) {
      console.error('[storage-rendered] delete failed:', error.message);
    }
  }
}

import { getSupabaseAdmin } from './supabase';

const BUCKET = 'report-pdfs';

/**
 * Upload a PDF to the report-pdfs bucket.
 * Returns the storage path.
 */
export async function uploadReportPdf(
  slug: string,
  buffer: Buffer
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const safeSlug = slug.replace(/[^a-zA-Z0-9-]/g, '_');
  const path = `${safeSlug}/${Date.now()}.pdf`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return path;
}

/**
 * Generate a short-lived signed URL for an admin to view a source PDF.
 * Returns null if the path doesn't exist or signing fails.
 */
export async function getReportPdfSignedUrl(
  path: string
): Promise<string | null> {
  if (!path) return null;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600); // 1 hour

  if (error) {
    console.error('[storage] Failed to create signed URL:', error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

/**
 * Delete a PDF from the bucket. Used when a draft is deleted.
 */
export async function deleteReportPdf(path: string): Promise<void> {
  if (!path) return;
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    console.error('[storage] Failed to delete PDF:', error.message);
  }
}

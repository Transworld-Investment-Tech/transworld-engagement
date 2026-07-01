/**
 * Build a download filename for a report PDF.
 * Slug-based for stable, sortable filenames (e.g. "Transworld-NGX-Weekly-2026-W18.pdf").
 */
export function buildPdfFilename(slug: string): string {
  return `Transworld-NGX-Weekly-${slug}.pdf`;
}

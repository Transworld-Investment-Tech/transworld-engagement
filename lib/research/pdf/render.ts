import { getBrowser } from './browser';

export interface RenderInput {
  /** Report slug. The renderer hits /research/print/{slug}. */
  slug: string;
  /** When true, the print page renders the draft watermark and allows
   *  rendering of unpublished reports (gated by PRINT_TOKEN). */
  isDraft: boolean;
}

/**
 * Render a report PDF by navigating Puppeteer to the internal print route
 * and exporting A4. Returns the PDF as a Buffer.
 *
 * Requires `NEXT_PUBLIC_APP_URL` and `PRINT_TOKEN` env vars.
 */
export async function renderReportPdf({
  slug,
  isDraft,
}: RenderInput): Promise<Buffer> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const printToken = process.env.PRINT_TOKEN;

  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL env var is not set.');
  }
  if (!printToken) {
    throw new Error('PRINT_TOKEN env var is not set.');
  }

  const url = `${appUrl.replace(/\/$/, '')}/research/print/${encodeURIComponent(
    slug
  )}${isDraft ? '?draft=1' : ''}`;

  const browser = await getBrowser();
  try {
    const page = await browser.newPage();

    // The print route checks this header to allow draft rendering and
    // confirms the request actually came from the renderer.
    await page.setExtraHTTPHeaders({ 'x-print-token': printToken });

    // A4 viewport at 96dpi (210mm × 297mm ≈ 794 × 1123 px).
    await page.setViewport({ width: 794, height: 1123 });

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Make sure web fonts have loaded before printing.
    // (Fraunces/Plus Jakarta/IBM Plex are loaded via next/font in the layout;
    // networkidle0 above is usually enough, but document.fonts.ready is
    // belt-and-suspenders.)
    await page.evaluate(async () => {
      // document.fonts is part of the FontFaceSet API, well-supported in Chromium.
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    const pdfData = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
    });

    // pdfData is a Uint8Array on newer puppeteer versions; normalise to Buffer.
    return Buffer.from(pdfData);
  } finally {
    await browser.close();
  }
}

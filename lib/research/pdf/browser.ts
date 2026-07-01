import type { Browser } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';

/**
 * Launch a headless browser suitable for the current runtime.
 *
 * - On Vercel/Lambda: uses `@sparticuz/chromium`. Three things matter here
 *   that aren't obvious from the Sparticuz README:
 *
 *   1. AWS_LAMBDA_JS_RUNTIME must be set BEFORE the chromium module is
 *      loaded. The dynamic import below means setting it on the line above
 *      works, but it's also safer to set it in the Vercel Dashboard env
 *      vars so it's there before any module load.
 *
 *   2. setGraphicsMode(false) disables Chromium's GPU process. On Lambda
 *      the GPU thread tends to hang because the runtime has no GPU at all.
 *
 *   3. LD_LIBRARY_PATH must point at the directory where Sparticuz extracts
 *      the chromium binary AND its bundled shared libraries (libnss3.so
 *      etc). Without this, the dynamic linker can't find them and you get
 *      "error while loading shared libraries: libnss3.so: cannot open".
 *      This is the single most common Vercel + chromium failure.
 *
 * - On local dev (Mac/Linux): tries CHROME_PATH env var, then falls back
 *   to common Chrome/Chromium install paths.
 *
 * The caller MUST close the returned browser (use try/finally).
 */
export async function getBrowser(): Promise<Browser> {
  const isServerless =
    !!process.env.VERCEL ||
    !!process.env.VERCEL_ENV ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.LAMBDA_TASK_ROOT;

  if (isServerless) {
    // Belt-and-suspenders fallback — primary place to set this is the Vercel
    // Dashboard env vars, but also default it here for safety. Set BEFORE
    // the dynamic import so chromium's module-load check sees it.
    if (!process.env.AWS_LAMBDA_JS_RUNTIME) {
      process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs22.x';
    }

    const chromiumModule = await import('@sparticuz/chromium');
    const chromium = chromiumModule.default;

    // Disable GPU mode — prevents Chromium hanging when no GPU is present.
    // (`setGraphicsMode` is a setter, not a method.)
    chromium.setGraphicsMode = false;

    // Resolving the executable path also extracts the binary and bundled
    // libs to /tmp/chromium. We need the dirname for LD_LIBRARY_PATH next.
    const executablePath = await chromium.executablePath();

    // CRITICAL: tell the dynamic linker where to look for libnss3.so etc.
    // Sparticuz puts them in the same dir as the chromium binary.
    const path = await import('path');
    const execDir = path.dirname(executablePath);
    process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
      ? `${execDir}:${process.env.LD_LIBRARY_PATH}`
      : execDir;

    return puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  }

  // ── Local dev: locate Chrome on the user's machine. ──
  const fs = await import('fs');
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter((p): p is string => Boolean(p));

  const executablePath = candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });

  if (!executablePath) {
    throw new Error(
      'No Chrome/Chromium found for local PDF rendering. ' +
        'Install Google Chrome, or set CHROME_PATH to your Chrome binary path.'
    );
  }

  return puppeteer.launch({
    executablePath,
    headless: true,
  });
}

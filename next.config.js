/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Research PDF rendering uses puppeteer-core + @sparticuz/chromium (which ships
  // a large Chromium binary). These must be treated as external server packages
  // so Next does not try to bundle them into the serverless function — bundling
  // breaks Sparticuz's binary/lib extraction. (Next 14 option name.)
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  },
  webpack: (config) => {
    // pdf.js (pdfjs-dist) references the optional Node-only `canvas` package for
    // server-side rendering. We only ever render PDFs in the browser, so alias
    // it away to keep the bundler from trying (and failing) to resolve it.
    config.resolve = config.resolve || {};
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false };
    return config;
  },
};
module.exports = nextConfig;

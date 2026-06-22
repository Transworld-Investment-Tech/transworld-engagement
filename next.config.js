/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

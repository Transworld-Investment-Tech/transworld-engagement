"use client";

export default function EmailPreview({ html, height = 520 }) {
  return (
    <iframe
      title="Email preview"
      srcDoc={html}
      sandbox=""
      className="w-full rounded-lg border border-line bg-white"
      style={{ height }}
    />
  );
}

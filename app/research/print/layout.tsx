import { Fraunces, Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';

// The print route renders an edge-to-edge A4 document for Puppeteer — no TopBar,
// no Footer, no AppShell. It still needs the editorial fonts: PrintLayout's
// inline @page CSS references var(--font-display / -body / -mono), which these
// next/font instances define on the wrapper below.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export default function ResearchPrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${fraunces.variable} ${jakarta.variable} ${plexMono.variable}`}
    >
      {children}
    </div>
  );
}

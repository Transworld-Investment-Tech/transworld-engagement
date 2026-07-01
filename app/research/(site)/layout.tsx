import type { Metadata } from 'next';
import { Fraunces, Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';
import { TopBar } from '@/components/research/TopBar';
import { Footer } from '@/components/research/Footer';

// Editorial identity, loaded ONLY inside the research (site) route group. These
// next/font instances set the --font-display / --font-body / --font-mono CSS
// variables that the .font-display/-body/-mono classes in globals.css read; the
// internal Greetings / Documents / admin screens never mount this layout, so
// they download zero editorial fonts and keep the Georgia house style.
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

export const metadata: Metadata = {
  title: 'Research · Transworld Investment & Securities',
  description:
    'Weekly equity research from Transworld Investment & Securities Limited',
};

export default function ResearchSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${fraunces.variable} ${jakarta.variable} ${plexMono.variable} font-body min-h-screen`}
      style={{ background: '#FAF7F2', color: '#0A1F44' }}
    >
      <TopBar />
      {children}
      <Footer />
    </div>
  );
}

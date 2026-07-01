import { redirect } from 'next/navigation';
import { Fraunces, Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';
import { getResearchUser, isResearchManager } from '@/lib/research/auth';
import AppShell from '@/components/AppShell';

// Research admin lives inside the Engagement shell (so it's still one app: the
// navy top nav carries Dashboard / Contacts / Greetings / Documents / Research),
// but the CONTENT wears the editorial sub-brand — Fraunces headlines, IBM Plex
// Mono tickers, navy ink — matching the public research site and the retired
// portal's admin. The editorial fonts load ONLY here and in the research (site)
// and print layouts, so Greetings / Documents / Dashboard still download none of
// them. The .font-display/-mono/-body classes the ported components already use
// resolve to these once the variables are set on the wrapper below.
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

export const dynamic = 'force-dynamic';

export default async function ResearchAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getResearchUser();
  if (!user) {
    redirect('/login?next=/research/admin');
  }
  if (!(await isResearchManager())) {
    // Signed in but not permitted to manage research — send to the dashboard.
    redirect('/dashboard');
  }

  return (
    <AppShell user={user}>
      <div
        className={`${fraunces.variable} ${jakarta.variable} ${plexMono.variable} font-body`}
        style={{ color: '#0A1F44' }}
      >
        {children}
      </div>
    </AppShell>
  );
}

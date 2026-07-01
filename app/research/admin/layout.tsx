import { redirect } from 'next/navigation';
import { getResearchUser, isResearchManager } from '@/lib/research/auth';
import AppShell from '@/components/AppShell';

// Research admin lives inside the Engagement shell (navy/gold, house style),
// gated at manager+. Editorial fonts are NOT loaded here — the .font-display
// classes fall back to the Georgia house serif, so these screens conform to the
// internal look while the public research site keeps its editorial identity.
export const dynamic = 'force-dynamic';

export default async function ResearchAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getResearchUser();
  if (!user) {
    redirect('/login?next=/research/admin/reports');
  }
  if (!(await isResearchManager())) {
    // Signed in but not permitted to manage research — send to the dashboard.
    redirect('/dashboard');
  }

  return <AppShell user={user}>{children}</AppShell>;
}

import { getCurrentUser, hasRole } from '@/lib/session';

/**
 * Research auth, mapped onto the Engagement session.
 *
 * The portal gated admin actions against a separate `admins` table under
 * Supabase-Auth. That table is NOT recreated in the merge — research admin
 * access is an ordinary Engagement staff session, gated at **manager+**
 * (matching the app's "manager+ can add/edit/import" rule; publishing a report
 * is an edit-class action). Plain `user` accounts can read but not manage.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'manager' | 'admin';
}

/** Current staff session, or null. */
export async function getResearchUser(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return (user as unknown as SessionUser) ?? null;
}

/** True when the current session is a manager or admin. */
export async function isResearchManager(): Promise<boolean> {
  const user = await getCurrentUser();
  return hasRole(user, 'manager');
}

/**
 * Enforce manager+. Throws 'Not authenticated' or 'Not authorized' — the caller
 * decides how to surface it (redirect for pages, JSON 401/403 for routes).
 * Returns the acting user's id for provenance columns (created_by, etc.).
 */
export async function requireResearchManager(): Promise<{ userId: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  if (!hasRole(user, 'manager')) throw new Error('Not authorized');
  return { userId: (user as unknown as SessionUser).id };
}

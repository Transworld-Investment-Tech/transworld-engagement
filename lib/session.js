import { cookies } from "next/headers";
import { readToken, sessionCookie } from "@/lib/auth";

// Returns the current user payload or null. Use inside server components and
// route handlers.
export async function getCurrentUser() {
  const token = cookies().get(sessionCookie.name)?.value;
  return readToken(token);
}

const RANK = { user: 1, manager: 2, admin: 3 };

export function hasRole(user, minRole) {
  if (!user) return false;
  return (RANK[user.role] || 0) >= (RANK[minRole] || 0);
}

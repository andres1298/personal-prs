import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isAdminUser } from './access-policy.js';
import { ensureAdminProfile, findProfile } from './records.js';

export { hasSameOrigin } from './access-policy.js';

export function hasAuthConfiguration() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export async function createAuthClient() {
  if (!hasAuthConfiguration()) throw new Error('Supabase Auth is not configured.');
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(values) {
          // Server Components cannot write cookies; the proxy refreshes them.
          try {
            values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    },
  );
}

export async function getAccess() {
  if (!hasAuthConfiguration()) return { user: null, authorized: false, isAdmin: false };
  const client = await createAuthClient();
  // Verify with Auth, including revoked sessions; never trust a cookie's user object.
  const { data, error } = await client.auth.getUser();
  const user = error ? null : data.user;
  if (isAdminUser(user, process.env.SUPABASE_ADMIN_USER_IDS)) {
    // Invitations reference the inviter's profile, so admins always have one.
    await ensureAdminProfile(user);
    return { user, authorized: true, isAdmin: true };
  }
  // Members gain access only through a profile created by accepting an invitation
  // and lose it as soon as an admin disables that profile.
  const profile = user && !user.is_anonymous ? await findProfile(user.id) : null;
  const authorized = Boolean(profile && !profile.disabledAt);
  return { user, authorized, isAdmin: false };
}

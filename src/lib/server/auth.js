import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isAuthorizedUser } from './access-policy.js';

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
  if (!hasAuthConfiguration()) return { user: null, authorized: false };
  const client = await createAuthClient();
  // Verify with Auth, including revoked sessions; never trust a cookie's user object.
  const { data, error } = await client.auth.getUser();
  const user = error ? null : data.user;
  return { user, authorized: isAuthorizedUser(user, process.env.SUPABASE_ALLOWED_USER_IDS) };
}

export function isAdminUser(user, adminUserIds = '') {
  const adminIds = new Set(adminUserIds.split(',').map((id) => id.trim()).filter(Boolean));
  return Boolean(user && !user.is_anonymous && adminIds.has(user.id));
}

export function hasSameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

// Supabase keeps the session in sb-<project>-auth-token cookies, split into .0, .1… chunks when large,
// plus PKCE code-verifier cookies. Returns Set-Cookie values that expire every one the request carries.
const AUTH_COOKIE = /^sb-[\w-]+-auth-token(?:\.\d+|-[\w-]+)?$/;

export function expiredAuthCookies(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const names = (request.headers.get('cookie') ?? '').split(';').map((part) => part.split('=')[0].trim());
  return [...new Set(names)].filter((name) => AUTH_COOKIE.test(name)).map((name) => `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`);
}

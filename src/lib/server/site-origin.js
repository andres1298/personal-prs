// Email links must open the public site, not whichever deployment or alias served the form:
// Vercel puts preview and deployment URLs behind its own login. Local development has neither variable.
export function siteOrigin(request) {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return new URL(configured).origin;
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : new URL(request.url).origin;
}

export function clientIp(request) {
  return request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
}

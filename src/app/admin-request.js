export async function request(url, options) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (response.status === 204) return {};
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Algo salió mal. Inténtalo de nuevo.');
  return body;
}

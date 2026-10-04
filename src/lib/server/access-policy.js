export function isAuthorizedUser(user, allowedUserIds = '') {
  const allowedIds = new Set(allowedUserIds.split(',').map((id) => id.trim()).filter(Boolean));
  return Boolean(user && !user.is_anonymous && allowedIds.has(user.id));
}

export function hasSameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

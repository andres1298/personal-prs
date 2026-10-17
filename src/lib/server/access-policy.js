export function isAdminUser(user, adminUserIds = '') {
  const adminIds = new Set(adminUserIds.split(',').map((id) => id.trim()).filter(Boolean));
  return Boolean(user && !user.is_anonymous && adminIds.has(user.id));
}

export function hasSameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

// Shared by sign-up, invitations and password reset; the forms render the same limits.
export const MIN_PASSWORD_LENGTH = 8;
// Supabase hashes passwords with bcrypt, which ignores everything past 72 bytes.
export const MAX_PASSWORD_LENGTH = 72;

export function isValidPasswordLength(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

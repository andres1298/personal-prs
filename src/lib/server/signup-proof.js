import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Gym sign-ups use the public Supabase sign-up API, so anyone holding the publishable key could
// create an Auth user. The server therefore signs the email with a key derived from the gym code
// when the code was proven; access is granted only to confirmed users carrying that signature.
export const PROOF_METADATA_KEY = 'gym_signup_proof';

// Case and surrounding spaces are ignored so the code is easy to type on a phone.
export function normalizeGymCode(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function digest(value) {
  return createHash('sha256').update(value).digest();
}

// Comparing fixed-length digests keeps the comparison time independent of the shared prefix.
export function matchesGymCode(candidate, expected) {
  const code = normalizeGymCode(expected);
  if (!code) return false;
  return timingSafeEqual(digest(normalizeGymCode(candidate)), digest(code));
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function createSignupProof(email, gymCode) {
  const code = normalizeGymCode(gymCode);
  if (!code) throw new Error('The gym signup code is not configured.');
  // Rotating the code changes the key, which invalidates proofs of unconfirmed accounts.
  const key = digest(`gym-signup-proof:${code}`);
  return createHmac('sha256', key).update(normalizeEmail(email)).digest('base64url');
}

// A confirmed, non-anonymous user whose metadata carries a proof for their own email.
// Metadata is editable by the user, but a valid proof cannot be forged without the code.
export function isEligibleForMemberProfile(user, gymCode) {
  if (!user || user.is_anonymous || !user.email_confirmed_at || !normalizeGymCode(gymCode)) return false;
  const proof = user.user_metadata?.[PROOF_METADATA_KEY];
  if (typeof proof !== 'string' || !proof) return false;
  const expected = Buffer.from(createSignupProof(user.email, gymCode));
  const actual = Buffer.from(proof);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

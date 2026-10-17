import 'server-only';
import { createClient } from '@supabase/supabase-js';

// The secret key bypasses RLS and manages Auth users; it must never reach the browser.
export function getAuthAdmin() {
  if (!globalThis.personalPrsAuthAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secretKey) throw new Error('Supabase admin access is not configured.');
    globalThis.personalPrsAuthAdmin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth.admin;
  }
  return globalThis.personalPrsAuthAdmin;
}

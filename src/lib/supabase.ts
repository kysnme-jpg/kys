import { createClient } from "@supabase/supabase-js";

export const ITEM_PHOTOS_BUCKET = "item-photos";

// Server-side (service role — bypasses RLS for uploads), lazy-initialized at runtime
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key);
}

// Client-side helper, lazy-initialized
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase client credentials not configured.");
  }
  return createClient(url, key);
}

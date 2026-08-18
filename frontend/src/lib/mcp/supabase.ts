import { createClient } from "@supabase/supabase-js";

export function supabaseForUser(token?: string) {
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
import { createClient } from "@supabase/supabase-js";
 
export const SUPABASE_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || "https://placeholder-project.supabase.co";
export const SUPABASE_KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || "placeholder-key";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});



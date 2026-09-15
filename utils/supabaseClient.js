// Backend-safe Supabase client (Node.js serverless / Vercel).
// Mirrors utils/supabaseClient.ts but uses process.env ONLY (no import.meta.env)
// to avoid Vercel @vercel/node ESM loader SyntaxError ("Unexpected token '>>>').
import { createClient } from "@supabase/supabase-js";

const env = process.env;
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("placeholder")) {
  console.warn("[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not configured. Using placeholder - some features will not work.");
}

export const SUPABASE_URL = supabaseUrl || "https://placeholder.supabase.co";
export const SUPABASE_KEY = supabaseKey || "placeholder-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    flowType: "pkce",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

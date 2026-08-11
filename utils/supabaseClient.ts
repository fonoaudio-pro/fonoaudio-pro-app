import { createClient } from "@supabase/supabase-js";

// import.meta.env works in Vite (frontend), process.env works in Node.js (serverless)
const env = (typeof import.meta !== 'undefined' && import.meta.env) || process.env;

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
  console.warn('[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not configured. Using placeholder - some features will not work.');
}

export const SUPABASE_URL = supabaseUrl || 'https://placeholder.supabase.co';
export const SUPABASE_KEY = supabaseKey || 'placeholder-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});



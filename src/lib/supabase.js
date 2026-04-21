import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase env vars. Check your .env file.');
}

// Storage that works across tab closes and refreshes
const customStorage = {
  getItem: (k) => {
    try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch { return null; }
  },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v); } catch { try { sessionStorage.setItem(k, v); } catch {} }
  },
  removeItem: (k) => {
    try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch {}
  },
};

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: customStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

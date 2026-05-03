import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const createClient = () => {
  // Use build-time env vars or runtime window-injected vars
  const url = supabaseUrl || (typeof window !== 'undefined' && (window as any).VITE_SUPABASE_URL);
  const key = supabaseKey || (typeof window !== 'undefined' && (window as any).VITE_SUPABASE_ANON_KEY);

  if (!url || !key) {
    console.error("Supabase config missing!");
    return null;
  }
  return createSupabaseClient(url, key);
};

export const supabase = createClient();

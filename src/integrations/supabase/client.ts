import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const ANON_KEY = 'am_public_anon';

function createSupabaseClient() {
  const url = typeof window !== 'undefined'
    ? window.location.origin
    : (typeof process !== 'undefined' && process.env['SUPABASE_URL']) || 'https://artisan-mural.pages.dev';
  return createClient<Database>(url, ANON_KEY, {
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
      detectSessionInUrl: typeof window !== 'undefined',
      storageKey: 'am-auth',
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

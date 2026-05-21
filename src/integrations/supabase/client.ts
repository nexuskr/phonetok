import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// ============================================
// 환경변수 검증 (Production 필수)
// ============================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    '[Supabase] VITE_SUPABASE_URL이 설정되지 않았습니다. .env 파일을 확인하세요.'
  );
}
if (!supabaseAnonKey) {
  throw new Error(
    '[Supabase] VITE_SUPABASE_ANON_KEY (또는 PUBLISHABLE_KEY)가 설정되지 않았습니다.'
  );
}

// ============================================
// Supabase Client (God-tier 설정)
// ============================================
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'phonara-web@3.0.0',
    },
  },
});

// 개발 환경에서만 로그 출력
if (import.meta.env.DEV) {
  console.log('%c[Supabase] Client initialized successfully', 'color:#22c55e', {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
  });
}

export type SupabaseClient = typeof supabase;
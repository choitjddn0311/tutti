import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * 브라우저용 Supabase 클라이언트 (publishable 키).
 * Realtime(Broadcast/Presence) 전용 — 테이블·Storage는 RLS로 차단되어 있으므로
 * 데이터 조회·변경은 서버(Route Handler / Server Action)를 거친다.
 */
export function getBrowserSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * 브라우저용 Supabase 클라이언트 (publishable 키).
 * Realtime(Broadcast/Presence) 전용 — 테이블·Storage는 RLS로 차단되어 있으므로
 * 데이터 조회·변경은 서버(Route Handler / Server Action)를 거친다.
 * 유일한 예외: 서버가 발급한 서명 URL로 악보 파일 1개를 직접 업로드(`uploadToSignedUrl`).
 * (Vercel 함수 요청 본문 4.5MB 제한 때문 — PROJECT.md §4 업로드 경로)
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
    // 응답 없는 소켓을 빨리 알아채고 재연결한다 (기본 25초)
    realtime: { heartbeatIntervalMs: 10_000 },
  });
  return client;
}

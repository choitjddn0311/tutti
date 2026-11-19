import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * 서버 전용 Supabase 클라이언트 (secret 키, RLS 우회).
 * 모든 DB·Storage 접근은 이 클라이언트로 하며, 호출 전에 방 코드를 검증한다.
 */
export function getServerSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "Supabase 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY",
    );
  }

  client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

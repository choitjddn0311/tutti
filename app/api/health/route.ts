import { connection } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * 헬스체크: DB 연결 + 입장 쿠키 서명 키 설정 여부 (값은 내보내지 않음).
 * 키가 없으면 입장·방 목록이 실패하므로 원인을 바로 알 수 있게 함께 보고한다.
 */
export async function GET() {
  // cacheComponents가 켜져 있어 GET 핸들러도 빌드 시 프리렌더될 수 있음 → 항상 요청 시 실행
  await connection();
  const sessionKey = (process.env.ROOM_SESSION_SECRET?.length ?? 0) >= 32 ? "ok" : "missing";

  try {
    const { error } = await getServerSupabase().from("rooms").select("id").limit(1);
    if (error) {
      console.error("[health] db query failed:", error.message);
      return Response.json({ db: "error", sessionKey }, { status: 503 });
    }
    return Response.json({ db: "ok", sessionKey }, { status: sessionKey === "ok" ? 200 : 503 });
  } catch (e) {
    console.error("[health] unexpected error:", e);
    return Response.json({ db: "error", sessionKey }, { status: 503 });
  }
}

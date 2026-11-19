import { connection } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/** DB 연결 확인용 헬스체크. */
export async function GET() {
  // cacheComponents가 켜져 있어 GET 핸들러도 빌드 시 프리렌더될 수 있음 → 항상 요청 시 실행
  await connection();

  try {
    const { error } = await getServerSupabase().from("rooms").select("id").limit(1);
    if (error) {
      console.error("[health] db query failed:", error.message);
      return Response.json({ db: "error" }, { status: 503 });
    }
    return Response.json({ db: "ok" });
  } catch (e) {
    console.error("[health] unexpected error:", e);
    return Response.json({ db: "error" }, { status: 503 });
  }
}

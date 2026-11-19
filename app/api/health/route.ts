import { getServerSupabase } from "@/lib/supabase/server";

/** DB 연결 확인용 헬스체크. 요청 시마다 실행된다(GET 라우트 핸들러는 기본 비캐시). */
export async function GET() {
  try {
    const { error } = await getServerSupabase()
      .from("rooms")
      .select("id", { head: true, count: "exact" });

    if (error) {
      return Response.json({ db: "error", message: error.message }, { status: 503 });
    }
    return Response.json({ db: "ok" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return Response.json({ db: "error", message }, { status: 503 });
  }
}

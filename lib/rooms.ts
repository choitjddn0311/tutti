import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { readRoomSession, ROOM_CODE_RE, type RoomSession } from "@/lib/room-auth";

export { ALLOWED_MIME, MAX_UPLOAD_BYTES, SCORES_BUCKET } from "@/lib/upload-rules";

export type Room = {
  id: string;
  code: string;
  name: string;
  current_song_id: string | null;
  current_page: number;
};

export type Song = {
  id: string;
  title: string;
  position: number;
  file_type: "pdf" | "image";
  page_count: number;
};

/** 비밀번호 해시를 포함한 방 조회 — 입장 검증 전용. 결과를 클라이언트로 넘기지 않는다. */
export async function findRoomWithHash(code: string) {
  if (!ROOM_CODE_RE.test(code)) return null;
  const { data, error } = await getServerSupabase()
    .from("rooms")
    .select("id, code, name, current_song_id, current_page, password_hash")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error("방 조회 실패");
  return data as (Room & { password_hash: string }) | null;
}

/**
 * 현재 요청이 이 방에 입장한 상태인지 확인하고 방을 돌려준다.
 * 모든 방 데이터 접근(페이지 렌더, Server Action)은 이 함수를 먼저 거친다.
 */
export async function requireRoom(
  code: string,
): Promise<{ room: Room; session: RoomSession } | null> {
  const session = await readRoomSession(code);
  if (!session) return null;
  const { data, error } = await getServerSupabase()
    .from("rooms")
    .select("id, code, name, current_song_id, current_page")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error("방 조회 실패");
  if (!data || data.id !== session.roomId) return null;
  return { room: data as Room, session };
}

export async function listSongs(roomId: string): Promise<Song[]> {
  const { data, error } = await getServerSupabase()
    .from("songs")
    .select("id, title, position, file_type, page_count")
    .eq("room_id", roomId)
    .order("position", { ascending: true });
  if (error) throw new Error("셋리스트 조회 실패");
  return data as Song[];
}

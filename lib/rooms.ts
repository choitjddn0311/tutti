import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { readRoomSession, ROOM_CODE_RE, roomListRef, type RoomSession } from "@/lib/room-auth";
import { POSITION_TTL_MS, SCORES_BUCKET } from "@/lib/upload-rules";

export { ALLOWED_MIME, MAX_UPLOAD_BYTES, SCORES_BUCKET } from "@/lib/upload-rules";

export type Room = {
  id: string;
  code: string;
  name: string;
  current_song_id: string | null;
  current_page: number;
  position_updated_at: string | null;
};

export type Song = {
  id: string;
  title: string;
  position: number;
  file_type: "pdf" | "image";
  page_count: number;
};

/** 이번 합주의 현재 위치. 저장한 지 오래됐으면 위치 없음 */
export function currentPosition(room: Room): { songId: string | null; page: number } {
  const at = room.position_updated_at ? Date.parse(room.position_updated_at) : 0;
  if (Date.now() - at > POSITION_TTL_MS) return { songId: null, page: 1 };
  return { songId: room.current_song_id, page: room.current_page };
}

/** 방 번호로 방 조회 (입장용) */
export async function findRoomByCode(code: string): Promise<Room | null> {
  if (!ROOM_CODE_RE.test(code)) return null;
  const { data, error } = await getServerSupabase()
    .from("rooms")
    .select("id, code, name, current_song_id, current_page, position_updated_at")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error("방 조회 실패");
  return data as Room | null;
}

/** 방 목록 항목. 방 번호는 입장 비밀번호 역할이라 목록에 넣지 않는다 (2026-11-22 사용자 결정) */
export type RoomListItem = { ref: string; name: string; songCount: number };

/** 첫 화면 방 목록 (최근 생성순 100개). 번호 없이 이름·곡 수만 */
export async function listRooms(): Promise<RoomListItem[]> {
  const { data, error } = await getServerSupabase()
    .from("rooms")
    .select("id, name, songs!songs_room_id_fkey(count)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("방 목록 조회 실패");
  return (data as { id: string; name: string; songs: { count: number }[] }[]).map((r) => ({
    ref: roomListRef(r.id),
    name: r.name,
    songCount: r.songs?.[0]?.count ?? 0,
  }));
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
    .select("id, code, name, current_song_id, current_page, position_updated_at")
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

const SCORE_URL_TTL = 60 * 60 * 4; // 4시간 — 합주 한 번 동안 유효

export type SongWithUrl = Song & { url: string };

/** 방 소속 곡 1개 + 악보 파일 서명 URL. `requireRoom`을 통과한 roomId로만 호출한다. */
export async function getSongWithUrl(
  roomId: string,
  songId: string,
): Promise<SongWithUrl | null> {
  if (!/^[0-9a-f-]{36}$/i.test(songId)) return null;
  const db = getServerSupabase();
  const { data, error } = await db
    .from("songs")
    .select("id, title, position, file_type, page_count, file_path")
    .eq("id", songId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (error) throw new Error("곡 조회 실패");
  if (!data) return null;

  const { data: signed, error: signErr } = await db.storage
    .from(SCORES_BUCKET)
    .createSignedUrl(data.file_path, SCORE_URL_TTL);
  if (signErr || !signed) throw new Error("악보 URL 발급 실패");

  return {
    id: data.id,
    title: data.title,
    position: data.position,
    file_type: data.file_type,
    page_count: data.page_count,
    url: signed.signedUrl,
  };
}

export type Section = { id: string; label: string; page: number; x: number; y: number };

/** 곡의 섹션 라벨 (페이지 → 위치 순). `requireRoom`을 통과한 roomId로만 호출한다. */
export async function listSectionsForSong(roomId: string, songId: string): Promise<Section[]> {
  if (!/^[0-9a-f-]{36}$/i.test(songId)) return [];
  const db = getServerSupabase();
  // 곡이 이 방 소속인지 확인 (sections에는 room_id가 없음)
  const { data: song } = await db
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (!song) return [];
  const { data, error } = await db
    .from("sections")
    .select("id, label, page, x, y")
    .eq("song_id", songId)
    .order("page", { ascending: true })
    .order("y", { ascending: true });
  if (error) throw new Error("섹션 조회 실패");
  return data as Section[];
}

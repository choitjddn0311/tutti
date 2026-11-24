"use server";

import { getServerSupabase } from "@/lib/supabase/server";
import { requireRoom } from "@/lib/rooms";
import { MAX_PDF_PAGES } from "@/lib/upload-rules";

/**
 * 리더의 현재 곡/페이지를 rooms에 저장 → 늦게 들어오거나 새로고침한 참가자가 맞춘다.
 * 리더 여부는 Presence(브라우저)에만 있으므로 서버는 방 입장만 확인한다 (지인 팀 신뢰 기반).
 * 페이지는 1~MAX_PDF_PAGES로만 검증한다. DB page_count는 업로드 시 브라우저가 센 값이라
 * 실제 PDF와 다를 수 있고, 뷰어는 실제 쪽수를 따르므로 page_count로 막으면 리더 위치가 저장되지 않는다.
 */
export async function setPosition(
  code: string,
  songId: string,
  page: number,
): Promise<{ ok: boolean; /** 곡이 삭제됨 */ gone?: boolean }> {
  const auth = await requireRoom(code);
  if (!auth) return { ok: false };
  if (
    !/^[0-9a-f-]{36}$/i.test(songId) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > MAX_PDF_PAGES
  ) {
    return { ok: false };
  }

  const db = getServerSupabase();
  const { data: song, error: songErr } = await db
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("room_id", auth.room.id)
    .maybeSingle();
  if (songErr) return { ok: false };
  if (!song) return { ok: false, gone: true };

  const { error } = await db
    .from("rooms")
    .update({
      current_song_id: songId,
      current_page: page,
      position_updated_at: new Date().toISOString(),
    })
    .eq("id", auth.room.id);
  return { ok: !error };
}

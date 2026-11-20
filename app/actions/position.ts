"use server";

import { getServerSupabase } from "@/lib/supabase/server";
import { requireRoom } from "@/lib/rooms";

/**
 * 리더의 현재 곡/페이지를 rooms에 저장 → 늦게 들어오거나 새로고침한 참가자가 맞춘다.
 * 리더 여부는 Presence(브라우저)에만 있으므로 서버는 방 입장만 확인한다 (지인 팀 신뢰 기반).
 * 페이지는 해당 곡의 page_count 범위로 검증한다.
 */
export async function setPosition(
  code: string,
  songId: string,
  page: number,
): Promise<{ ok: boolean }> {
  const auth = await requireRoom(code);
  if (!auth) return { ok: false };
  if (!/^[0-9a-f-]{36}$/i.test(songId) || !Number.isInteger(page) || page < 1) {
    return { ok: false };
  }

  const db = getServerSupabase();
  const { data: song } = await db
    .from("songs")
    .select("page_count")
    .eq("id", songId)
    .eq("room_id", auth.room.id)
    .maybeSingle();
  if (!song || page > song.page_count) return { ok: false };

  const { error } = await db
    .from("rooms")
    .update({ current_song_id: songId, current_page: page })
    .eq("id", auth.room.id);
  return { ok: !error };
}

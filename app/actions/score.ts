"use server";

import { getSongWithUrl, requireRoom } from "@/lib/rooms";

/** 악보 서명 URL 다시 발급 (만료·로드 실패 시). 실패하면 null */
export async function getScoreUrl(code: string, songId: string): Promise<string | null> {
  try {
    const auth = await requireRoom(code);
    if (!auth) return null;
    return (await getSongWithUrl(auth.room.id, songId))?.url ?? null;
  } catch {
    return null;
  }
}

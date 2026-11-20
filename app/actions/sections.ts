"use server";

import { getServerSupabase } from "@/lib/supabase/server";
import { listSectionsForSong, requireRoom, type Section } from "@/lib/rooms";
import { MAX_PDF_PAGES, MAX_SECTION_LABEL } from "@/lib/upload-rules";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const NOT_JOINED = { ok: false, error: "방에 입장한 상태가 아닙니다. 다시 입장하세요." } as const;

const isUnit = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;

/** 섹션 라벨 추가. 위치는 페이지 기준 0~1 정규화 좌표 (CLAUDE.md 규칙) */
export async function addSection(
  code: string,
  input: { songId: string; label: string; page: number; x: number; y: number },
): Promise<Result<{ sections: Section[] | null }>> {
  const auth = await requireRoom(code);
  if (!auth) return NOT_JOINED;
  if (typeof input?.label !== "string" || typeof input.songId !== "string") {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  const label = input.label.trim();
  if (!label || label.length > MAX_SECTION_LABEL) {
    return { ok: false, error: `섹션 이름은 1~${MAX_SECTION_LABEL}자로 입력하세요.` };
  }
  if (!Number.isInteger(input.page) || input.page < 1 || input.page > MAX_PDF_PAGES) {
    return { ok: false, error: "잘못된 페이지입니다." };
  }
  if (!isUnit(input.x) || !isUnit(input.y)) return { ok: false, error: "잘못된 위치입니다." };

  const db = getServerSupabase();
  const { data: song } = await db
    .from("songs")
    .select("id, file_type")
    .eq("id", input.songId)
    .eq("room_id", auth.room.id)
    .maybeSingle();
  if (!song) return { ok: false, error: "곡을 찾을 수 없습니다." };
  // 이미지 곡은 1쪽뿐. PDF는 DB page_count가 실제와 다를 수 있어(브라우저가 센 값) MAX_PDF_PAGES로만 제한
  if (song.file_type === "image" && input.page !== 1) return { ok: false, error: "잘못된 페이지입니다." };

  const { error } = await db.from("sections").insert({
    song_id: input.songId,
    label,
    page: input.page,
    x: input.x,
    y: input.y,
  });
  if (error) return { ok: false, error: "섹션을 저장하지 못했습니다." };
  // 저장은 성공했으므로 목록 재조회가 실패해도 ok (클라이언트가 다시 불러옴) — 실패로 보고하면 중복 추가된다
  const sections = await listSectionsForSong(auth.room.id, input.songId).catch(() => null);
  return { ok: true, sections };
}

export async function deleteSection(
  code: string,
  songId: string,
  sectionId: string,
): Promise<Result<{ sections: Section[] }>> {
  const auth = await requireRoom(code);
  if (!auth) return NOT_JOINED;
  if (!/^[0-9a-f-]{36}$/i.test(sectionId)) return { ok: false, error: "잘못된 요청입니다." };
  // 이 방의 곡에 속한 섹션만 삭제
  const sections = await listSectionsForSong(auth.room.id, songId);
  if (!sections.some((s) => s.id === sectionId)) return { ok: false, error: "섹션을 찾을 수 없습니다." };
  const { error } = await getServerSupabase().from("sections").delete().eq("id", sectionId);
  if (error) return { ok: false, error: "섹션을 삭제하지 못했습니다." };
  return { ok: true, sections: sections.filter((s) => s.id !== sectionId) };
}

/** 다른 사람이 섹션을 바꿨을 때 다시 불러오기 */
export async function getSections(code: string, songId: string): Promise<Section[]> {
  const auth = await requireRoom(code);
  if (!auth) return [];
  return listSectionsForSong(auth.room.id, songId);
}

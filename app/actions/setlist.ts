"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  requireRoom,
  SCORES_BUCKET,
} from "@/lib/rooms";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const NOT_JOINED = { ok: false, error: "방에 입장한 상태가 아닙니다. 다시 입장하세요." } as const;
const MAX_PDF_PAGES = 2000;

/** 1단계: 업로드 검증 후 서명 업로드 URL 발급. 파일 본문은 서버를 거치지 않는다. */
export async function prepareUpload(
  code: string,
  file: { contentType: string; size: number },
): Promise<Result<{ path: string; token: string }>> {
  const auth = await requireRoom(code);
  if (!auth) return NOT_JOINED;

  const mime = ALLOWED_MIME[file.contentType];
  if (!mime) return { ok: false, error: "PDF, PNG, JPEG, WebP 파일만 올릴 수 있습니다." };
  if (!(file.size > 0) || file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "파일은 20MB 이하여야 합니다." };
  }

  const path = `${auth.room.id}/${randomUUID()}.${mime.ext}`;
  const { data, error } = await getServerSupabase()
    .storage.from(SCORES_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "업로드를 준비하지 못했습니다." };
  return { ok: true, path: data.path, token: data.token };
}

/** 2단계: 업로드된 파일을 확인하고 셋리스트 맨 뒤에 곡을 추가한다. */
export async function finalizeUpload(
  code: string,
  input: { path: string; title: string; pageCount: number },
): Promise<Result> {
  const auth = await requireRoom(code);
  if (!auth) return NOT_JOINED;
  const { room } = auth;
  const db = getServerSupabase();
  const storage = db.storage.from(SCORES_BUCKET);

  const title = input.title.trim();
  if (!title || title.length > 100) return { ok: false, error: "곡 제목은 1~100자로 입력하세요." };

  // 다른 방 경로 / 경로 조작 차단
  const pathRe = new RegExp(`^${room.id}/[0-9a-f-]{36}\\.(pdf|png|jpg|webp)$`);
  if (!pathRe.test(input.path)) return { ok: false, error: "잘못된 파일 경로입니다." };

  const { data: info, error: infoErr } = await storage.info(input.path);
  if (infoErr || !info) return { ok: false, error: "업로드된 파일을 찾을 수 없습니다." };
  const mime = info.contentType ? ALLOWED_MIME[info.contentType] : undefined;
  if (!mime || !info.size || info.size > MAX_UPLOAD_BYTES) {
    await storage.remove([input.path]);
    return { ok: false, error: "지원하지 않는 파일이거나 용량을 초과했습니다." };
  }

  let pageCount = 1;
  if (mime.type === "pdf") {
    pageCount = Math.floor(input.pageCount);
    if (!(pageCount >= 1 && pageCount <= MAX_PDF_PAGES)) {
      await storage.remove([input.path]);
      return { ok: false, error: "PDF 페이지 수를 확인하지 못했습니다." };
    }
  }

  // 동시 추가로 position이 겹치면(23505) 다시 계산해 재시도
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: last } = await db
      .from("songs")
      .select("position")
      .eq("room_id", room.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (last?.position ?? 0) + 1;

    const { error } = await db.from("songs").insert({
      room_id: room.id,
      title,
      position,
      file_path: input.path,
      file_type: mime.type,
      page_count: pageCount,
    });
    if (!error) {
      refresh();
      return { ok: true };
    }
    if (error.code !== "23505") break;
  }
  await storage.remove([input.path]);
  return { ok: false, error: "곡을 추가하지 못했습니다." };
}

export async function deleteSong(code: string, songId: string): Promise<Result> {
  const auth = await requireRoom(code);
  if (!auth) return NOT_JOINED;
  const { room } = auth;
  const db = getServerSupabase();

  // 현재 곡을 지우면 현재 위치를 초기화 (FK가 current_song_id만 null로 만들기 때문)
  if (room.current_song_id === songId) {
    await db
      .from("rooms")
      .update({ current_song_id: null, current_page: 1 })
      .eq("id", room.id);
  }

  const { data, error } = await db
    .from("songs")
    .delete()
    .eq("id", songId)
    .eq("room_id", room.id)
    .select("file_path")
    .maybeSingle();
  if (error) return { ok: false, error: "곡을 삭제하지 못했습니다." };
  if (data) await db.storage.from(SCORES_BUCKET).remove([data.file_path]);

  refresh();
  return { ok: true };
}

export async function moveSong(
  code: string,
  songId: string,
  direction: -1 | 1,
): Promise<Result> {
  const auth = await requireRoom(code);
  if (!auth) return NOT_JOINED;
  if (direction !== -1 && direction !== 1) return { ok: false, error: "잘못된 요청입니다." };

  const { error } = await getServerSupabase().rpc("move_song", {
    p_room_id: auth.room.id,
    p_song_id: songId,
    p_direction: direction,
  });
  if (error) return { ok: false, error: "순서를 바꾸지 못했습니다." };

  refresh();
  return { ok: true };
}

"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireRoom } from "@/lib/rooms";
import {
  ALLOWED_MIME,
  MAX_PDF_PAGES,
  MAX_TITLE_LENGTH,
  MAX_UPLOAD_BYTES,
  SCORES_BUCKET,
} from "@/lib/upload-rules";

/** fatal: 이 파일만의 문제가 아니라 다음 파일도 실패할 오류 (예: 입장이 풀림) → 여러 개 올리기를 멈춘다 */
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; fatal?: boolean };

const NOT_JOINED = { ok: false, error: "방에 입장한 상태가 아닙니다. 다시 입장하세요.", fatal: true } as const;

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

  // 다른 방 경로 / 경로 조작 차단 (이 검사 전에는 파일을 지우지 않는다)
  const pathRe = new RegExp(`^${room.id}/[0-9a-f-]{36}\\.(pdf|png|jpg|webp)$`);
  const pathMatch = pathRe.exec(input.path);
  if (!pathMatch) return { ok: false, error: "잘못된 파일 경로입니다." };

  // 같은 경로를 두 번 finalize(재시도·중복 제출)해도 곡은 하나만 — 멱등 처리
  const { data: existing } = await db
    .from("songs")
    .select("id")
    .eq("room_id", room.id)
    .eq("file_path", input.path)
    .maybeSingle();
  if (existing) return { ok: true };

  const title = input.title.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) {
    await storage.remove([input.path]);
    return { ok: false, error: `곡 제목은 1~${MAX_TITLE_LENGTH}자로 입력하세요.` };
  }

  const { data: info, error: infoErr } = await storage.info(input.path);
  if (infoErr || !info) {
    // 확인에 실패해도 올라간 파일이 남지 않게 지운다 (경로는 위에서 이 방 것으로 검증됨)
    await storage.remove([input.path]).catch(() => {});
    return { ok: false, error: "업로드된 파일을 확인하지 못했습니다." };
  }
  const mime = info.contentType ? ALLOWED_MIME[info.contentType] : undefined;
  // prepareUpload에서 승인한 형식(경로 확장자)과 실제 업로드 형식이 같아야 한다
  if (!mime || mime.ext !== pathMatch[1] || !info.size || info.size > MAX_UPLOAD_BYTES) {
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
    // 동시 중복 finalize: file_path 유니크 위반이면 이미 추가된 것
    if (error.message.includes("songs_file_path_key")) return { ok: true };
  }
  await storage.remove([input.path]);
  return { ok: false, error: "곡을 추가하지 못했습니다." };
}

export async function deleteSong(code: string, songId: string): Promise<Result> {
  const auth = await requireRoom(code);
  if (!auth) return NOT_JOINED;
  const { room } = auth;
  const db = getServerSupabase();

  const { data, error } = await db
    .from("songs")
    .delete()
    .eq("id", songId)
    .eq("room_id", room.id)
    .select("file_path")
    .maybeSingle();
  if (error) return { ok: false, error: "곡을 삭제하지 못했습니다." };

  if (data) {
    await db.storage.from(SCORES_BUCKET).remove([data.file_path]);
    // 현재 곡이 지워졌으면 FK가 current_song_id만 null로 만든다 → 페이지도 초기화.
    // (삭제 성공 후, 현재 DB 상태 기준으로 조건부 갱신)
    await db
      .from("rooms")
      .update({ current_page: 1 })
      .eq("id", room.id)
      .is("current_song_id", null);
  }

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

"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { hashPassword, setRoomSession, verifyPassword } from "@/lib/room-auth";
import { findRoomWithHash } from "@/lib/rooms";

/** 오류 시 입력값을 돌려줘 폼 리셋 후에도 유지한다 (비밀번호 제외). */
export type FormState =
  | { error: string; values: Record<string, string> }
  | undefined;

function fail(form: FormData, error: string): FormState {
  const values: Record<string, string> = {};
  for (const k of ["code", "name", "nickname", "instrument"]) values[k] = field(form, k);
  return { error, values };
}

const CODE_RETRIES = 30;

function field(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function validateMember(
  form: FormData,
): { error: string } | { nickname: string; instrument: string } {
  const nickname = field(form, "nickname");
  const instrument = field(form, "instrument");
  if (!nickname || nickname.length > 20) return { error: "닉네임은 1~20자로 입력하세요." };
  if (!instrument || instrument.length > 20) return { error: "악기는 1~20자로 입력하세요." };
  return { nickname, instrument };
}

function validatePassword(form: FormData): { error: string } | { password: string } {
  // 공백 포함 그대로 사용(trim 하지 않음)
  const v = form.get("password");
  const password = typeof v === "string" ? v : "";
  if (password.length < 4 || password.length > 64) {
    return { error: "비밀번호는 4~64자로 입력하세요." };
  }
  return { password };
}

export async function createRoom(_prev: FormState, form: FormData): Promise<FormState> {
  const name = field(form, "name");
  if (!name || name.length > 40) return fail(form, "방 이름은 1~40자로 입력하세요.");
  const member = validateMember(form);
  if ("error" in member) return fail(form, member.error);
  const pw = validatePassword(form);
  if ("error" in pw) return fail(form, pw.error);

  const passwordHash = await hashPassword(pw.password);
  const db = getServerSupabase();

  let created: { id: string; code: string } | null = null;
  for (let i = 0; i < CODE_RETRIES && !created; i++) {
    const code = randomInt(0, 10000).toString().padStart(4, "0");
    const { data, error } = await db
      .from("rooms")
      .insert({ code, name, password_hash: passwordHash })
      .select("id, code")
      .single();
    if (!error) created = data;
    else if (error.code !== "23505") return fail(form, "방을 만들지 못했습니다. 잠시 후 다시 시도하세요.");
  }
  if (!created) return fail(form, "사용 가능한 방 코드를 찾지 못했습니다.");

  await setRoomSession(created.code, { roomId: created.id, ...member });
  redirect(`/room/${created.code}`);
}

export async function joinRoom(_prev: FormState, form: FormData): Promise<FormState> {
  const code = field(form, "code");
  if (!/^[0-9]{4}$/.test(code)) return fail(form, "방 코드는 숫자 4자리입니다.");
  const member = validateMember(form);
  if ("error" in member) return fail(form, member.error);
  const pw = validatePassword(form);
  if ("error" in pw) return fail(form, "방 코드 또는 비밀번호가 올바르지 않습니다.");

  const room = await findRoomWithHash(code);
  // 방이 없어도 해시 계산 비용을 맞춰, 응답 시간으로 방 존재 여부가 드러나지 않게 한다.
  const ok = room
    ? await verifyPassword(pw.password, room.password_hash)
    : (await hashPassword(pw.password), false);
  if (!room || !ok) return fail(form, "방 코드 또는 비밀번호가 올바르지 않습니다.");

  await setRoomSession(room.code, { roomId: room.id, ...member });
  redirect(`/room/${room.code}`);
}

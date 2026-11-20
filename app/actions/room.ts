"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { roomListRef, setRoomSession } from "@/lib/room-auth";
import { findRoomByCode } from "@/lib/rooms";

/** 오류 시 입력값을 돌려줘 폼 리셋 후에도 유지한다. */
export type FormState =
  | { error: string; values: Record<string, string> }
  | undefined;

function fail(form: FormData, error: string): FormState {
  const values: Record<string, string> = {};
  // 방 번호는 비밀번호 역할이라 오류 후 다시 채우지 않는다
  for (const k of ["name", "nickname", "instrument"]) values[k] = field(form, k);
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

/**
 * 방 만들기. 별도 비밀번호 없이 랜덤 4자리 방 번호가 입장 비밀번호 역할 (2026-11-22 결정).
 * 첫 화면 목록엔 이름만 보이고, 입장하려면 번호를 입력한다. 만든 사람은 방 안에서 번호를 확인해 공유.
 * 입장 쿠키는 닉네임·악기와 방 ID를 담아 계속 쓴다 (requireRoom).
 */
export async function createRoom(_prev: FormState, form: FormData): Promise<FormState> {
  const name = field(form, "name");
  if (!name || name.length > 40) return fail(form, "방 이름은 1~40자로 입력하세요.");
  const member = validateMember(form);
  if ("error" in member) return fail(form, member.error);

  const db = getServerSupabase();
  let created: { id: string; code: string } | null = null;
  for (let i = 0; i < CODE_RETRIES && !created; i++) {
    const code = randomInt(0, 10000).toString().padStart(4, "0");
    const { data, error } = await db
      .from("rooms")
      .insert({ code, name })
      .select("id, code")
      .single();
    if (!error) created = data;
    else if (error.code !== "23505") return fail(form, "방을 만들지 못했습니다. 잠시 후 다시 시도하세요.");
  }
  if (!created) return fail(form, "사용 가능한 방 코드를 찾지 못했습니다.");

  await setRoomSession(created.code, { roomId: created.id, ...member });
  redirect(`/room/${created.code}`);
}

/** 방 번호 + 닉네임·악기로 입장. 목록에서 고른 경우 ref(목록 참조값)로 그 방의 번호인지 확인 */
export async function joinRoom(_prev: FormState, form: FormData): Promise<FormState> {
  const code = field(form, "code");
  if (!/^[0-9]{4}$/.test(code)) return fail(form, "방 번호는 숫자 4자리입니다.");
  const member = validateMember(form);
  if ("error" in member) return fail(form, member.error);

  // 방 번호가 입장 비밀번호 역할 (2026-11-22). 목록에서 방을 골랐으면 그 방의 번호와 맞아야 한다
  const ref = field(form, "ref");
  const room = await findRoomByCode(code);
  // 없는 번호와 틀린 번호를 같은 안내로 (어느 번호가 존재하는지 알려 주지 않게)
  if (!room || (ref && roomListRef(room.id) !== ref)) {
    return fail(form, "방 번호가 맞지 않습니다.");
  }

  await setRoomSession(room.code, { roomId: room.id, ...member });
  redirect(`/room/${room.code}`);
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRoom, joinRoom, type FormState } from "@/app/actions/room";

const input =
  "h-11 w-full rounded-lg border border-zinc-300 bg-transparent px-3 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";
const primary =
  "h-12 w-full rounded-lg bg-zinc-900 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

// 기기별로 마지막에 쓴 닉네임·악기를 기억해 다음 입장 때 미리 채운다 (편의 기능, 실패해도 무시)
const MEMBER_KEY = "tutti:member";
function loadMember(): { nickname?: string; instrument?: string } {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(MEMBER_KEY) ?? "{}");
    if (!v || typeof v !== "object") return {};
    const { nickname, instrument } = v as Record<string, unknown>;
    return {
      nickname: typeof nickname === "string" ? nickname : undefined,
      instrument: typeof instrument === "string" ? instrument : undefined,
    };
  } catch {
    return {};
  }
}
function saveMember(form: HTMLFormElement) {
  try {
    const fd = new FormData(form);
    localStorage.setItem(
      MEMBER_KEY,
      JSON.stringify({ nickname: fd.get("nickname"), instrument: fd.get("instrument") }),
    );
  } catch {
    // 사생활 보호 모드 등
  }
}

function MemberFields({ state }: { state: FormState }) {
  const nickRef = useRef<HTMLInputElement>(null);
  const instRef = useRef<HTMLInputElement>(null);
  // 서버 렌더와 어긋나지 않게 마운트 후에 채운다 (오류로 돌아온 값이 있으면 그 값 유지)
  useEffect(() => {
    if (state?.values) return;
    const m = loadMember();
    if (nickRef.current && !nickRef.current.value && m.nickname) nickRef.current.value = m.nickname;
    if (instRef.current && !instRef.current.value && m.instrument) instRef.current.value = m.instrument;
  }, [state]);

  return (
    <>
      <input ref={nickRef} name="nickname" placeholder="닉네임" maxLength={20} required defaultValue={state?.values.nickname} className={input} />
      <input ref={instRef} name="instrument" placeholder="악기 (예: 피아노)" maxLength={20} required defaultValue={state?.values.instrument} className={input} />
    </>
  );
}

function ErrorText({ state }: { state: FormState }) {
  return state?.error ? (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {state.error}
    </p>
  ) : null;
}

export function CreateRoomForm() {
  const [state, action, pending] = useActionState(createRoom, undefined);
  return (
    <form action={action} onSubmit={(e) => saveMember(e.currentTarget)} className="flex flex-col gap-3">
      <input name="name" placeholder="방 이름" maxLength={40} required defaultValue={state?.values.name} className={input} />
      <MemberFields state={state} />
      <ErrorText state={state} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "만드는 중…" : "방 만들기"}
      </button>
    </form>
  );
}

/**
 * 방 입장: 방 번호(비밀번호 역할) + 닉네임·악기.
 * - code: 링크(/room/1234)로 들어와 번호를 이미 아는 경우 → 번호 칸 숨김
 * - roomRef: 첫 화면 목록에서 고른 방 → 번호를 입력해야 하고, 그 방의 번호와 맞아야 입장
 */
export function JoinRoomForm({ code, roomRef }: { code?: string; roomRef?: string }) {
  const [state, action, pending] = useActionState(joinRoom, undefined);
  return (
    <form action={action} onSubmit={(e) => saveMember(e.currentTarget)} className="flex flex-col gap-3">
      {roomRef && <input type="hidden" name="ref" value={roomRef} />}
      {code ? (
        <input type="hidden" name="code" value={code} />
      ) : (
        <input
          name="code"
          type="password"
          placeholder="방 번호 (숫자 4자리)"
          aria-label="방 번호"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          autoComplete="off"
          autoFocus={!!roomRef}
          className={`${input} tracking-[0.5em]`}
        />
      )}
      <MemberFields state={state} />
      <ErrorText state={state} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "입장 중…" : "입장"}
      </button>
    </form>
  );
}

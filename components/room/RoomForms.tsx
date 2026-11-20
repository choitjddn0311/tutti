"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRoom, joinRoom, type FormState } from "@/app/actions/room";
import { btnPrimary, field } from "@/components/ui";

const input = field;
const primary = `${btnPrimary} w-full`;

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
    <p role="alert" className="px-2 text-sm text-danger">
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
          // type=password는 브라우저가 사이트 비밀번호로 저장·자동완성해(다른 방에 옛 번호가 채워짐) 숫자 키패드도 안 뜬다
          // → 텍스트 칸을 CSS로 가림
          type="text"
          placeholder="방 번호 (숫자 4자리)"
          aria-label="방 번호"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          autoComplete="off"
          style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
          autoFocus={!!roomRef}
          className={`${input} text-center text-lg font-bold tracking-[0.6em] placeholder:text-base placeholder:font-normal placeholder:tracking-normal`}
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

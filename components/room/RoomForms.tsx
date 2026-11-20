"use client";

import { useActionState } from "react";
import { createRoom, joinRoom, type FormState } from "@/app/actions/room";

const input =
  "h-11 w-full rounded-lg border border-zinc-300 bg-transparent px-3 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";
const primary =
  "h-12 w-full rounded-lg bg-zinc-900 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

function MemberFields({ state }: { state: FormState }) {
  return (
    <>
      <input name="nickname" placeholder="닉네임" maxLength={20} required defaultValue={state?.values.nickname} className={input} />
      <input name="instrument" placeholder="악기 (예: 피아노)" maxLength={20} required defaultValue={state?.values.instrument} className={input} />
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
    <form action={action} className="flex flex-col gap-3">
      <input name="name" placeholder="방 이름" maxLength={40} required defaultValue={state?.values.name} className={input} />
      <input
        name="password"
        type="password"
        placeholder="방 비밀번호 (4자 이상)"
        minLength={4}
        maxLength={64}
        required
        autoComplete="new-password"
        className={input}
      />
      <MemberFields state={state} />
      <ErrorText state={state} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "만드는 중…" : "방 만들기"}
      </button>
    </form>
  );
}

export function JoinRoomForm({ code }: { code?: string }) {
  const [state, action, pending] = useActionState(joinRoom, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      {code ? (
        <input type="hidden" name="code" value={code} />
      ) : (
        <input
          name="code"
          placeholder="방 코드 (숫자 4자리)"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          defaultValue={state?.values.code}
          className={`${input} tracking-widest`}
        />
      )}
      <input
        name="password"
        type="password"
        placeholder="방 비밀번호"
        required
        autoComplete="current-password"
        className={input}
      />
      <MemberFields state={state} />
      <ErrorText state={state} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "입장 중…" : "입장"}
      </button>
    </form>
  );
}

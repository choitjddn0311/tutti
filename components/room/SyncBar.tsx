"use client";

import { useRoomRealtime } from "./RoomRealtime";

const chip =
  "h-8 shrink-0 rounded-full border px-3 text-xs font-medium disabled:opacity-40";

/**
 * 리더·따라가기 조작. compact = 뷰어 상단용 한 줄.
 * Provider 밖이면 아무것도 그리지 않는다.
 */
export function SyncControls({ compact = false }: { compact?: boolean }) {
  const rt = useRoomRealtime();
  if (!rt) return null;
  const { isLeader, leader, follow, setFollow, takeLead, releaseLead, connected } = rt;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-400"}`}
        title={connected ? "실시간 연결됨" : "연결 중…"}
        aria-label={connected ? "실시간 연결됨" : "연결 중"}
      />
      <span className="min-w-0 truncate text-xs text-zinc-600 dark:text-zinc-400">
        {isLeader ? "내가 리더" : leader ? `리더: ${leader.nickname}` : "리더 없음"}
      </span>
      {isLeader ? (
        <button type="button" onClick={releaseLead} className={`${chip} border-amber-500 text-amber-700 dark:text-amber-400`}>
          리더 내려놓기
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setFollow(!follow)}
            aria-pressed={follow}
            className={`${chip} ${
              follow
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {follow ? "따라가는 중" : "따로 보기"}
          </button>
          {!compact && (
            <button
              type="button"
              onClick={takeLead}
              disabled={!connected}
              className={`${chip} border-zinc-300 dark:border-zinc-700`}
            >
              리더 맡기
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** 접속자 목록 (닉네임·악기·리더) */
export function MemberList() {
  const rt = useRoomRealtime();
  if (!rt) return null;
  const { members, leader, me } = rt;
  const sorted = [...members].sort((a, b) =>
    a.clientId === leader?.clientId ? -1 : b.clientId === leader?.clientId ? 1 : a.nickname.localeCompare(b.nickname),
  );

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-zinc-500">접속자 {members.length}명</h2>
      <ul className="flex flex-wrap gap-2">
        {sorted.map((m) => (
          <li
            key={m.clientId}
            className={`rounded-full border px-3 py-1 text-sm ${
              m.clientId === leader?.clientId
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            {m.clientId === leader?.clientId && <span aria-label="리더">👑 </span>}
            {m.nickname}
            <span className="text-zinc-500"> · {m.instrument}</span>
            {m.clientId === me.clientId && <span className="text-zinc-400"> (나)</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

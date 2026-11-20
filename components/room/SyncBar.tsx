"use client";

import { useRoomRealtime } from "./RoomRealtime";

/** 연결 상태 점 (색 대신 채움/외곽선으로 구분) */
function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-fg" : "border border-muted"}`}
      title={connected ? "실시간 연결됨" : "연결 중…"}
      aria-label={connected ? "실시간 연결됨" : "연결 중"}
    />
  );
}

/**
 * 리더·따라가기 조작.
 * - 기본: 워크스페이스 사이드바용 (상태 줄 + 큰 알약 버튼 세로 배치)
 * - compact: 뷰어 상단용 한 줄
 * Provider 밖이면 아무것도 그리지 않는다.
 */
export function SyncControls({ compact = false }: { compact?: boolean }) {
  const rt = useRoomRealtime();
  if (!rt) return null;
  const { isLeader, leader, follow, setFollow, takeLead, releaseLead, connected } = rt;
  const status = isLeader ? "내가 리더" : leader ? `리더 ${leader.nickname}` : "리더 없음";

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <LiveDot connected={connected} />
        <span className="min-w-0 truncate text-xs text-muted">{status}</span>
        {isLeader ? (
          <button
            type="button"
            onClick={releaseLead}
            className="h-8 shrink-0 rounded-full border border-fg px-3 text-xs font-semibold"
          >
            리더 내려놓기
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setFollow(!follow)}
            aria-pressed={follow}
            className={`h-8 shrink-0 rounded-full px-3 text-xs font-bold ${
              follow ? "bg-fg text-canvas" : "border border-line text-fg"
            }`}
          >
            {follow ? "따라가는 중" : "따로 보기"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="flex items-center gap-2 text-sm text-muted">
        <LiveDot connected={connected} />
        {connected ? "실시간 연결됨" : "연결 중…"} · {status}
      </span>
      {isLeader ? (
        <button
          type="button"
          onClick={releaseLead}
          className="h-[52px] rounded-full border border-fg text-[15px] font-semibold"
        >
          리더 내려놓기
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setFollow(!follow)}
            aria-pressed={follow}
            className={`h-[52px] rounded-full text-[15px] font-bold transition active:scale-[0.98] ${
              follow ? "bg-fg text-canvas" : "border border-line text-fg"
            }`}
          >
            {follow ? "따라가는 중" : "따로 보기"}
          </button>
          <button
            type="button"
            onClick={takeLead}
            disabled={!connected}
            className="h-[52px] rounded-full border border-fg text-[15px] font-medium transition active:scale-[0.98] disabled:opacity-40"
          >
            리더 맡기
          </button>
        </>
      )}
    </div>
  );
}

/** 접속자 목록 (닉네임·악기·리더). 리더는 반전된 아바타로 표시 */
export function MemberList() {
  const rt = useRoomRealtime();
  if (!rt) return null;
  const { members, leader, me } = rt;
  const sorted = [...members].sort((a, b) =>
    a.clientId === leader?.clientId ? -1 : b.clientId === leader?.clientId ? 1 : a.nickname.localeCompare(b.nickname),
  );

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs text-muted">접속자 {members.length}명</h2>
      <ul className="flex flex-col gap-1">
        {sorted.map((m) => {
          const isLeader = m.clientId === leader?.clientId;
          return (
            <li
              key={m.clientId}
              className={`flex h-11 items-center gap-2.5 rounded-full px-1.5 ${isLeader ? "bg-raised" : ""}`}
            >
              <span
                aria-hidden
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  isLeader ? "bg-fg text-canvas" : "bg-canvas text-fg ring-1 ring-line"
                }`}
              >
                {Array.from(m.nickname)[0] ?? "?"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {m.nickname}
                <span className="font-normal text-muted">
                  {" "}
                  {m.instrument}
                  {m.clientId === me.clientId && " (나)"}
                </span>
              </span>
              {isLeader && <span className="mr-2 shrink-0 text-xs font-bold">리더</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

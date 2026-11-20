"use client";

import { useRoomRealtime } from "./RoomRealtime";

const CUE_COLOR: Record<string, string> = {
  스톱: "bg-red-600",
  엔딩: "bg-violet-600",
  처음으로: "bg-sky-600",
  "한 번 더": "bg-emerald-600",
};

/**
 * 방 전체(셋리스트·뷰어)에 겹쳐 뜨는 알림.
 * 프리셋 큐는 화면 위쪽에 크게, 메시지·다른 쪽 위치 사인은 아래쪽에 작게. 탭하면 닫힌다.
 */
export function RoomNotices() {
  const rt = useRoomRealtime();
  if (!rt) return null;
  const { notices, dismissNotice } = rt;
  const cue = notices.find((n) => n.kind === "cue");
  const toasts = notices.filter((n) => n.kind !== "cue");

  return (
    <>
      {cue && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={() => dismissNotice(cue.id)}
            role="alert"
            className={`pointer-events-auto rounded-2xl px-8 py-4 text-center text-white shadow-lg ${
              CUE_COLOR[cue.text] ?? "bg-zinc-800"
            }`}
          >
            <span className="block text-4xl font-bold tracking-tight sm:text-5xl">{cue.text}</span>
            <span className="mt-1 block text-sm opacity-80">{cue.from}</span>
          </button>
        </div>
      )}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
          {toasts.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => dismissNotice(n.id)}
              role="status"
              className="pointer-events-auto max-w-md rounded-full bg-zinc-900/90 px-4 py-2 text-sm text-white shadow-md dark:bg-zinc-100/90 dark:text-zinc-900"
            >
              <strong className="mr-1">{n.from}</strong>
              {n.kind === "point" ? `📍 ${n.text}` : n.text}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

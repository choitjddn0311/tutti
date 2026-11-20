"use client";

import { CUE_GLASS } from "./cueColors";
import { useRoomRealtime } from "./RoomRealtime";
import { glassChip } from "@/components/ui";


/**
 * 방 전체(셋리스트·뷰어)에 겹쳐 뜨는 알림.
 * 프리셋 큐는 화면 위쪽에 크게, 메시지·다른 쪽 위치 사인은 아래쪽에 작게. 탭하면 닫힌다.
 */
export function RoomNotices() {
  const rt = useRoomRealtime();
  if (!rt) return null;
  const { notices, dismissNotice, openSong } = rt;
  const cue = notices.find((n) => n.kind === "cue");
  const toasts = notices.filter((n) => n.kind !== "cue");

  return (
    <>
      {cue && (
        <div className="pointer-events-none fixed inset-x-0 top-28 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={() => dismissNotice(cue.id)}
            role="alert"
            // 글래스: 악보 위에 떠도 아래 악보가 비쳐 보이게
            className={`glass pointer-events-auto rounded-full px-10 py-3.5 text-center text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35)] ${
              CUE_GLASS[cue.text] ?? "bg-black/55"
            }`}
          >
            <span className="block text-4xl font-bold tracking-tight sm:text-5xl">{cue.text}</span>
            <span className="mt-0.5 block text-sm opacity-90">{cue.from}</span>
          </button>
        </div>
      )}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4">
          {toasts.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                dismissNotice(n.id);
                if (n.kind === "point" && n.songId && n.text.startsWith("다른 곡")) openSong(n.songId);
              }}
              role="status"
              className={`pointer-events-auto max-w-md px-5 py-2.5 text-sm ${glassChip}`}
            >
              <strong className="mr-1">{n.from}</strong>
              {n.kind === "point" ? `위치 · ${n.text}` : n.text}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

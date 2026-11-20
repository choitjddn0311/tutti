"use client";

import type { Section } from "@/lib/rooms";
import type { PointSignal } from "@/components/room/RoomRealtime";
import { glassChip } from "@/components/ui";

export type PlaceMode = "none" | "point" | "section";

/**
 * 악보 페이지와 같은 크기의 레이어. 위치는 모두 페이지 기준 0~1 정규화 좌표(left/top %)로 그린다
 * → 화면 크기가 다른 기기에서도 같은 위치. 놓기 모드에서는 탭한 위치를 정규화해 돌려준다.
 */
export function PageOverlay({
  page,
  sections,
  points,
  mode,
  onPlace,
}: {
  page: number;
  sections: Section[];
  points: PointSignal[];
  mode: PlaceMode;
  /** 탭한 위치(0~1)와 이 오버레이가 그려진 쪽 */
  onPlace: (x: number, y: number, page: number) => void;
}) {
  const here = sections.filter((s) => s.page === page);
  const pointsHere = points.filter((p) => p.page === page);

  return (
    <div
      className={`absolute inset-0 ${mode === "none" ? "pointer-events-none" : "z-20 cursor-crosshair touch-manipulation"}`}
      onClick={(e) => {
        if (mode === "none") return;
        const r = e.currentTarget.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        const clamp = (v: number) => Math.min(1, Math.max(0, v));
        onPlace(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height), page);
      }}
      data-testid="page-overlay"
    >
      {mode !== "none" && (
        <div className="pointer-events-none absolute inset-0 bg-black/5 ring-2 ring-inset ring-black/70" />
      )}

      {here.map((s) => (
        <span
          key={s.id}
          className={`pointer-events-none absolute -translate-y-1/2 px-2 py-0.5 text-xs font-bold ${glassChip}`}
          style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
          data-section={s.label}
        >
          {s.label}
        </span>
      ))}

      {pointsHere.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          data-point={p.from}
        >
          {/* 유리 링: 가운데 음표가 가려지지 않도록 안쪽은 거의 투명 */}
          <span className="absolute -inset-3 animate-ping rounded-full border-2 border-black/40" />
          <span className="relative block h-11 w-11 rounded-full border-2 border-black/80 bg-white/20 shadow-[0_0_0_4px_rgb(255_255_255/0.4),inset_0_1px_0_rgb(255_255_255/0.6)] backdrop-blur-[1.5px]" />
          <span className={`absolute left-1/2 top-[54px] -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 text-xs font-bold ${glassChip}`}>
            {p.from}
          </span>
        </span>
      ))}
    </div>
  );
}

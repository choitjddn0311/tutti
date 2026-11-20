"use client";

import type { Section } from "@/lib/rooms";
import type { PointSignal } from "@/components/room/RoomRealtime";

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
  onPlace: (x: number, y: number) => void;
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
        onPlace(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
      }}
      data-testid="page-overlay"
    >
      {mode !== "none" && (
        <div className="pointer-events-none absolute inset-0 bg-sky-500/10 ring-2 ring-inset ring-sky-500" />
      )}

      {here.map((s) => (
        <span
          key={s.id}
          className="pointer-events-none absolute -translate-y-1/2 rounded-md bg-amber-400/90 px-1.5 py-0.5 text-xs font-bold text-zinc-900 shadow"
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
          <span className="absolute -inset-4 animate-ping rounded-full bg-red-500/40" />
          <span className="relative block h-5 w-5 rounded-full border-2 border-white bg-red-500 shadow" />
          <span className="absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded bg-red-600 px-1.5 text-xs font-medium text-white">
            {p.from}
          </span>
        </span>
      ))}
    </div>
  );
}

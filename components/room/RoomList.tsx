"use client";

import { useState } from "react";
import type { RoomListItem } from "@/lib/rooms";
import { JoinRoomForm } from "./RoomForms";

/** 첫 화면 방 목록: 이름·곡 수만 보이고, 누르면 그 방의 번호(비밀번호 역할)를 입력해 입장 */
export function RoomList({ rooms }: { rooms: RoomListItem[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-1.5">
      {rooms.map((r) => {
        const isOpen = open === r.ref;
        return (
          <li
            key={r.ref}
            className={`overflow-hidden rounded-3xl border transition-colors ${
              isOpen ? "border-fg bg-canvas" : "border-line"
            }`}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : r.ref)}
              className="flex min-h-16 w-full items-center gap-4 px-5 py-3 text-left hover:bg-raised/60"
            >
              <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{r.name}</span>
              <span className="shrink-0 text-sm text-muted">곡 {r.songCount}개</span>
              <span
                aria-hidden
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-base transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4">
                <JoinRoomForm roomRef={r.ref} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

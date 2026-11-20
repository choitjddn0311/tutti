"use client";

import { useState } from "react";
import type { RoomListItem } from "@/lib/rooms";
import { JoinRoomForm } from "./RoomForms";

/** 첫 화면 방 목록: 이름·곡 수만 보이고, 누르면 그 방의 번호(비밀번호 역할)를 입력해 입장 */
export function RoomList({ rooms }: { rooms: RoomListItem[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {rooms.map((r) => (
        <li key={r.ref}>
          <button
            type="button"
            aria-expanded={open === r.ref}
            onClick={() => setOpen(open === r.ref ? null : r.ref)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
            <span className="shrink-0 text-sm text-zinc-500">곡 {r.songCount}개</span>
            <span className="shrink-0 text-zinc-400">{open === r.ref ? "▴" : "▾"}</span>
          </button>
          {open === r.ref && (
            <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-900 dark:bg-zinc-900/50">
              <JoinRoomForm roomRef={r.ref} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

"use client";

import Link from "next/link";
import { useRoomRealtime } from "./RoomRealtime";
import { MemberList, SyncControls } from "./SyncBar";

/** 셋리스트 화면 상단: 리더·따라가기 조작, 현재 합주 위치, 접속자 */
export function RoomLive({ songs }: { songs: { id: string; title: string }[] }) {
  const rt = useRoomRealtime();
  if (!rt) return null;
  const { position, code, leader } = rt;
  // 리더가 있을 때만 '지금 위치' 표시 (리더가 없으면 DB 값은 지난 합주 위치일 수 있음)
  const current =
    leader && position.songId ? songs.find((s) => s.id === position.songId) : undefined;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <SyncControls />
      {current && (
        <Link
          href={`/room/${code}/song/${current.id}`}
          className="flex items-center justify-between gap-2 rounded-md bg-zinc-100 px-3 py-2 text-sm hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          <span className="min-w-0 truncate">
            지금 위치: <strong>{current.title}</strong> · {position.page}쪽
          </span>
          <span className="shrink-0 text-zinc-500">열기 →</span>
        </Link>
      )}
      <MemberList />
    </section>
  );
}

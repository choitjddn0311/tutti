"use client";

import { useState } from "react";
import Link from "next/link";
import { useRoomRealtime } from "./RoomRealtime";
import { SignalPanel } from "./SignalPanel";
import { MemberList, SyncControls } from "./SyncBar";

/** 워크스페이스 사이드바의 실시간 부분: 리더·따라가기 조작, 접속자 */
export function RoomSidebarLive() {
  const rt = useRoomRealtime();
  if (!rt) return null;
  return (
    <>
      <SyncControls />
      <MemberList />
    </>
  );
}

/** 셋리스트 위: 사인 버튼 + 현재 합주 위치 카드 */
export function RoomNowPlaying({ songs }: { songs: { id: string; title: string }[] }) {
  const rt = useRoomRealtime();
  const [panelOpen, setPanelOpen] = useState(false);
  if (!rt) return <h2 className="text-3xl font-bold tracking-tight">셋리스트</h2>;
  const { position, code, leader } = rt;
  // 리더가 있을 때만 '지금 위치' 표시 (리더가 없으면 DB 값은 지난 합주 위치일 수 있음)
  const current =
    leader && position.songId ? songs.find((s) => s.id === position.songId) : undefined;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-3xl font-bold tracking-tight">셋리스트</h2>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="h-11 shrink-0 rounded-full border border-fg px-5 text-sm font-semibold active:scale-[0.98]"
        >
          사인
        </button>
      </div>
      {panelOpen && <SignalPanel onClose={() => setPanelOpen(false)} />}
      {current && (
        <Link
          href={`/room/${code}/song/${current.id}`}
          className="flex items-center justify-between gap-3 rounded-[20px] bg-fg px-5 py-4 text-canvas"
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-medium text-neutral-600">지금 위치 · 리더 {leader?.nickname}</span>
            <span className="truncate text-xl font-bold">
              {current.title} · {position.page}쪽
            </span>
          </span>
          <span className="flex h-12 shrink-0 items-center rounded-full bg-canvas px-5 text-[15px] font-bold text-fg">
            악보 열기
          </span>
        </Link>
      )}
    </>
  );
}

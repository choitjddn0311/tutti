"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSetlist } from "@/app/actions/setlist";

export type PickerSong = {
  id: string;
  title: string;
  file_type: "pdf" | "image";
  page_count: number;
};

/**
 * 뷰어 안에서 셋리스트를 펼쳐 곡을 바로 고른다 (셋리스트 화면으로 나가지 않음).
 * 리더가 고르면 새 곡 뷰어가 위치를 알려 따라가는 사람도 함께 이동한다.
 */
export function SongPicker({
  code,
  initialSongs,
  currentId,
  onClose,
}: {
  code: string;
  /** 뷰어를 연 시점의 셋리스트 — 바로 보여주고, 열 때마다 최신 목록으로 바꾼다 */
  initialSongs: PickerSong[];
  currentId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [songs, setSongs] = useState(initialSongs);
  // 합주 중 다른 사람이 곡을 올리거나 지웠을 수 있으므로 열 때 다시 불러온다
  useEffect(() => {
    let active = true;
    getSetlist(code)
      .then((list) => {
        if (active && list) setSongs(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [code]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-label="곡 목록"
        className="max-h-[75dvh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">셋리스트</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-zinc-500">
            닫기
          </button>
        </div>
        {songs.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500">곡 목록을 불러오지 못했습니다.</p>
        ) : (
          <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {songs.map((s, i) => {
              const current = s.id === currentId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={current ? "true" : undefined}
                    onClick={() => {
                      onClose();
                      if (!current) router.push(`/room/${code}/song/${s.id}`);
                    }}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-3 text-left ${
                      current ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <span className="w-6 text-right text-sm text-zinc-500">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{s.title}</span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {current ? "보는 중" : s.file_type === "pdf" ? `${s.page_count}쪽` : "이미지"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

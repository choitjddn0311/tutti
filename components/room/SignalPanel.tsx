"use client";

import { useState } from "react";
import { MAX_MESSAGE_LENGTH, MAX_SECTION_LABEL, PRESET_CUES } from "@/lib/upload-rules";
import type { Section } from "@/lib/rooms";
import { useRoomRealtime } from "./RoomRealtime";

const btn =
  "h-12 rounded-xl border border-zinc-300 text-base font-semibold active:scale-[0.98] dark:border-zinc-700";

/**
 * 사인 보내기 패널 (아래에서 올라오는 시트).
 * 셋리스트에서는 큐·메시지만, 뷰어에서는 위치 사인·섹션 라벨까지.
 */
export function SignalPanel({
  onClose,
  viewer,
}: {
  onClose: () => void;
  viewer?: {
    page: number;
    sections: Section[];
    busy: boolean;
    onStartPoint: () => void;
    onStartSection: (label: string) => void;
    onJump: (page: number) => void;
    onDeleteSection: (id: string) => void;
  };
}) {
  const rt = useRoomRealtime();
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState("");
  if (!rt) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-label="사인 보내기"
        className="max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">사인 보내기</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-zinc-500">
            닫기
          </button>
        </div>

        <section className="grid grid-cols-2 gap-2">
          {PRESET_CUES.map((cue) => (
            <button
              key={cue}
              type="button"
              className={btn}
              onClick={() => {
                rt.sendCue(cue);
                onClose();
              }}
            >
              {cue}
            </button>
          ))}
        </section>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!message.trim()) return;
            rt.sendMessage(message);
            setMessage("");
            onClose();
          }}
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="짧은 메시지"
            aria-label="메시지"
            className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
          />
          <button type="submit" className="h-11 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            보내기
          </button>
        </form>

        {viewer && (
          <>
            <button
              type="button"
              className={`${btn} mt-3 w-full border-red-400 text-red-600`}
              onClick={() => {
                viewer.onStartPoint();
                onClose();
              }}
            >
              📍 악보 위치 찍어 보여주기
            </button>

            <section className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <h3 className="mb-2 text-sm font-medium text-zinc-500">섹션 라벨</h3>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!label.trim()) return;
                  viewer.onStartSection(label.trim());
                  setLabel("");
                  onClose();
                }}
              >
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={MAX_SECTION_LABEL}
                  placeholder="예: A, 후렴, 코다"
                  aria-label="섹션 이름"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
                />
                <button
                  type="submit"
                  disabled={viewer.busy}
                  className="h-11 rounded-lg border border-amber-500 px-3 text-sm font-medium text-amber-700 disabled:opacity-40 dark:text-amber-400"
                >
                  위치 지정
                </button>
              </form>
              {viewer.sections.length > 0 && (
                <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
                  {viewer.sections.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 py-1.5">
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm"
                        onClick={() => {
                          viewer.onJump(s.page);
                          onClose();
                        }}
                      >
                        <span className="rounded bg-amber-400/90 px-1.5 text-xs font-bold text-zinc-900">{s.label}</span>
                        <span className="ml-2 text-zinc-500">{s.page}쪽으로 이동</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`${s.label} 삭제`}
                        disabled={viewer.busy}
                        onClick={() => viewer.onDeleteSection(s.id)}
                        className="h-8 w-8 rounded-md border border-zinc-300 text-xs disabled:opacity-30 dark:border-zinc-700"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

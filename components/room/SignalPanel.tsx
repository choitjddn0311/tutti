"use client";

import { useState } from "react";
import { MAX_MESSAGE_LENGTH, MAX_SECTION_LABEL, PRESET_CUES } from "@/lib/upload-rules";
import type { Section } from "@/lib/rooms";
import { useRoomRealtime } from "./RoomRealtime";
import { CUE_COLOR } from "./cueColors";
import { btnOutline, btnPrimary, field } from "@/components/ui";
import { PinIcon } from "@/components/icons";

const btn = "h-12 rounded-full text-base font-bold text-white active:scale-[0.98]";

/**
 * 사인 보내기 패널 (아래에서 올라오는 시트).
 * 셋리스트에서는 큐·메시지만, 뷰어에서는 위치 사인·섹션 라벨까지.
 */
export function SignalPanel({
  onClose,
  viewer,
  showCues = true,
}: {
  onClose: () => void;
  /** 뷰어는 악보 아래 줄에 큐 버튼이 있으므로 패널에서는 숨긴다 */
  showCues?: boolean;
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
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label="사인 보내기"
        className="mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border-x border-t border-line bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{showCues ? "사인 보내기" : "메시지 · 섹션"}</h2>
          <button type="button" onClick={onClose} className="h-9 rounded-full bg-raised px-4 text-sm">
            닫기
          </button>
        </div>

        {showCues && <section className="grid grid-cols-2 gap-2">
          {PRESET_CUES.map((cue) => (
            <button
              key={cue}
              type="button"
              className={`${btn} ${CUE_COLOR[cue] ?? "bg-raised"}`}
              onClick={() => {
                rt.sendCue(cue);
                onClose();
              }}
            >
              {cue}
            </button>
          ))}
        </section>}

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
            className={`${field} min-w-0 flex-1`}
          />
          <button type="submit" className={`${btnPrimary} shrink-0`}>
            보내기
          </button>
        </form>

        {viewer && (
          <>
            <button
              type="button"
              className={`${btnOutline} mt-3 h-12 w-full gap-2`}
              onClick={() => {
                viewer.onStartPoint();
                onClose();
              }}
            >
              <PinIcon /> 악보 위치 찍어 보여주기
            </button>

            <section className="mt-5 border-t border-line pt-4">
              <h3 className="mb-2 text-sm text-muted">섹션 라벨</h3>
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
                  className={`${field} min-w-0 flex-1`}
                />
                <button
                  type="submit"
                  disabled={viewer.busy}
                  className={`${btnOutline} h-12 shrink-0`}
                >
                  위치 지정
                </button>
              </form>
              {viewer.sections.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1">
                  {viewer.sections.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 rounded-full bg-raised py-1 pl-1.5 pr-1">
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm"
                        onClick={() => {
                          viewer.onJump(s.page);
                          onClose();
                        }}
                      >
                        <span className="rounded-full bg-fg px-2.5 py-0.5 text-xs font-bold text-canvas">{s.label}</span>
                        <span className="ml-2 text-muted">{s.page}쪽으로 이동</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`${s.label} 삭제`}
                        disabled={viewer.busy}
                        onClick={() => viewer.onDeleteSection(s.id)}
                        className="h-9 w-9 rounded-full bg-canvas text-xs disabled:opacity-30"
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

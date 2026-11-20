"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { addSection, deleteSection, getSections } from "@/app/actions/sections";
import { useRoomRealtime, type PointSignal } from "@/components/room/RoomRealtime";
import { SignalPanel } from "@/components/room/SignalPanel";
import { SyncControls } from "@/components/room/SyncBar";
import type { Section } from "@/lib/rooms";
import { ImagePage } from "./ImagePage";
import { PageOverlay, type PlaceMode } from "./PageOverlay";
import { useElementSize, usePageKeys, useWakeLock } from "./hooks";

const POINT_MS = 5000; // 위치 사인 표시 시간

// pdf.js는 브라우저 API(DOMMatrix 등)를 쓰므로 서버 렌더링에서 제외
const PdfPages = dynamic(() => import("./PdfPages"), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-zinc-500">뷰어 준비 중…</p>,
});

type Props = {
  songId: string;
  title: string;
  url: string;
  fileType: "pdf" | "image";
  pageCount: number;
  backHref: string;
  code: string;
  initialSections: Section[];
};

export function ScoreViewer({
  songId,
  title,
  url,
  fileType,
  pageCount,
  backHref,
  code,
  initialSections,
}: Props) {
  const rt = useRoomRealtime();
  // 새로고침·늦은 입장: 리더의 현재 위치(DB 값)가 이 곡이면 그 쪽에서 시작
  const [page, setPage] = useState(() =>
    rt?.position.songId === songId ? Math.max(1, rt.position.page) : 1,
  );
  const [numPages, setNumPages] = useState(fileType === "pdf" ? pageCount : 1);
  const [boxRef, box] = useElementSize<HTMLDivElement>();
  const wakeLock = useWakeLock();

  const prev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const next = useCallback(() => setPage((p) => Math.min(numPages, p + 1)), [numPages]);
  usePageKeys(prev, next);

  // ---------- 동기화 ----------
  const isLeader = rt?.isLeader ?? false;
  const publish = rt?.publishPosition;
  // 리더: 내 위치를 모두에게 알림 (리더를 맡는 순간에도 현재 위치를 알림)
  useEffect(() => {
    if (isLeader && publish) publish(songId, page);
  }, [isLeader, publish, songId, page]);

  // 따라가기: 리더가 이 곡에서 넘기면 같은 쪽으로 (다른 곡 이동은 Provider가 처리)
  const subscribe = rt?.subscribePosition;
  // 실제 쪽수를 알기 전(PDF 로드 전)에는 DB page_count가 틀릴 수 있으므로 자르지 않는다 → onNumPages가 범위를 맞춤
  const realPagesRef = useRef<number | null>(fileType === "pdf" ? null : 1);
  useEffect(() => {
    if (!subscribe) return;
    return subscribe((pos) => {
      if (pos.songId !== songId) return;
      const max = realPagesRef.current;
      setPage(Math.max(1, max ? Math.min(pos.page, max) : pos.page));
    });
  }, [subscribe, songId]);

  // ---------- 5단계: 섹션 라벨·위치 사인 ----------
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [points, setPoints] = useState<PointSignal[]>([]);
  const [mode, setMode] = useState<PlaceMode>("none");
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  });

  // 위치 사인 받기: 이 곡의 지금 보는 쪽이면 그리고 true (아니면 Provider가 알림으로 띄움)
  const subscribePoints = rt?.subscribePoints;
  useEffect(() => {
    if (!subscribePoints) return;
    return subscribePoints((p) => {
      if (p.songId !== songId || p.page !== pageRef.current) return false;
      setPoints((list) => [...list.filter((x) => x.id !== p.id), p]);
      setTimeout(() => setPoints((list) => list.filter((x) => x.id !== p.id)), POINT_MS);
      return true;
    });
  }, [subscribePoints, songId]);

  // 다른 사람이 이 곡의 섹션을 바꾸면 다시 불러온다
  const subscribeSections = rt?.subscribeSections;
  useEffect(() => {
    if (!subscribeSections) return;
    return subscribeSections((changed) => {
      if (changed !== songId) return;
      void getSections(code, songId).then(setSections);
    });
  }, [subscribeSections, songId, code]);

  const onPlace = useCallback(
    (x: number, y: number) => {
      if (mode === "point") {
        rt?.sendPoint(songId, page, x, y);
        setMode("none");
      } else if (mode === "section" && pendingLabel) {
        setMode("none");
        setBusy(true);
        setSectionError(null);
        void addSection(code, { songId, label: pendingLabel, page, x, y })
          .then((r) => {
            if (r.ok) {
              setSections(r.sections);
              rt?.notifySectionsChanged(songId);
            } else setSectionError(r.error);
          })
          .finally(() => {
            setBusy(false);
            setPendingLabel(null);
          });
      }
    },
    [mode, pendingLabel, rt, songId, page, code],
  );

  const removeSection = useCallback(
    (id: string) => {
      setBusy(true);
      void deleteSection(code, songId, id)
        .then((r) => {
          if (r.ok) {
            setSections(r.sections);
            rt?.notifySectionsChanged(songId);
          } else setSectionError(r.error);
        })
        .finally(() => setBusy(false));
    },
    [code, songId, rt],
  );

  const overlayFor = (p: number) => (
    <PageOverlay page={p} sections={sections} points={points} mode={mode} onPlace={onPlace} />
  );

  // 실제 PDF 쪽수가 DB 값과 다르면 실제 값을 따르고, 범위를 넘은 현재 쪽을 당겨온다
  const onNumPages = useCallback((n: number) => {
    realPagesRef.current = n;
    setNumPages(n);
    setPage((p) => Math.min(p, n));
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-zinc-100 dark:bg-zinc-900">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-2 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href={backHref}
          className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          ← 셋리스트
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-center font-medium">{title}</h1>
        <span
          className={`hidden text-xs sm:inline ${wakeLock ? "text-emerald-600" : "text-zinc-400"}`}
          title={wakeLock ? "화면 꺼짐 방지 켜짐" : "화면 꺼짐 방지를 사용할 수 없음"}
        >
          {wakeLock ? "화면 유지" : "화면 유지 꺼짐"}
        </span>
        <div className="flex items-center gap-1">
          <NavButton label="이전 페이지" onClick={prev} disabled={page <= 1}>
            ‹
          </NavButton>
          <span className="w-14 text-center text-sm tabular-nums" aria-live="polite">
            {page} / {numPages}
          </span>
          <NavButton label="다음 페이지" onClick={next} disabled={page >= numPages}>
            ›
          </NavButton>
        </div>
      </header>
      {rt && (
        <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
          <SyncControls compact />
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="h-8 shrink-0 rounded-full bg-zinc-900 px-3 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            사인
          </button>
        </div>
      )}
      {mode !== "none" && (
        <div className="flex h-10 shrink-0 items-center justify-between gap-2 bg-sky-600 px-3 text-sm text-white">
          <span>
            {mode === "point" ? "악보에서 보여줄 위치를 탭하세요" : `'${pendingLabel}' 섹션 위치를 탭하세요`}
          </span>
          <button
            type="button"
            onClick={() => {
              setMode("none");
              setPendingLabel(null);
            }}
            className="rounded-md bg-white/20 px-2 py-1 text-xs"
          >
            취소
          </button>
        </div>
      )}
      {sectionError && (
        <button
          type="button"
          onClick={() => setSectionError(null)}
          className="h-8 shrink-0 bg-red-600 px-3 text-left text-xs text-white"
        >
          {sectionError} (닫기)
        </button>
      )}

      {/* 악보 영역: 왼쪽 절반 탭 = 이전, 오른쪽 절반 탭 = 다음 */}
      <div className="relative min-h-0 flex-1 p-2">
        <div ref={boxRef} className="h-full w-full">
          {fileType === "pdf" ? (
            <PdfPages url={url} page={page} box={box} onNumPages={onNumPages} overlay={overlayFor} />
          ) : (
            <ImagePage url={url} alt={title} box={box} overlay={overlayFor(1)} />
          )}
        </div>
        {/* 놓기 모드에서는 탭이 페이지 위치 지정에 쓰이므로 넘김 영역을 끈다 */}
        {numPages > 1 && mode === "none" && (
          // touch-manipulation: 빠른 연속 탭이 더블탭 확대로 처리되지 않게
          <div className="absolute inset-0 flex touch-manipulation" aria-hidden>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={noFocus}
              className="h-full w-1/2 cursor-w-resize outline-none"
              onClick={prev}
            />
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={noFocus}
              className="h-full w-1/2 cursor-e-resize outline-none"
              onClick={next}
            />
          </div>
        )}
      </div>

      {panelOpen && (
        <SignalPanel
          onClose={() => setPanelOpen(false)}
          viewer={{
            page,
            sections,
            busy,
            onStartPoint: () => setMode("point"),
            onStartSection: (label) => {
              setPendingLabel(label);
              setMode("section");
            },
            onJump: (p) => setPage(Math.max(1, Math.min(p, numPages))),
            onDeleteSection: removeSection,
          }}
        />
      )}
    </div>
  );
}

/**
 * 넘김 버튼이 클릭으로 포커스를 가져가지 않게 한다. 포커스된 버튼에서 Space(페달)를 누르면
 * 키 핸들러의 '다음'과 버튼 클릭이 겹쳐 두 쪽이 넘어갈 수 있기 때문. click 이벤트는 그대로 발생한다.
 */
function noFocus(e: React.MouseEvent) {
  e.preventDefault();
}

function NavButton({
  label,
  children,
  ...props
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={noFocus}
      className="h-9 w-9 rounded-md border border-zinc-300 text-lg leading-none disabled:opacity-30 dark:border-zinc-700"
      {...props}
    >
      {children}
    </button>
  );
}

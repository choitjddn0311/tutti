"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRoomRealtime } from "@/components/room/RoomRealtime";
import { SyncControls } from "@/components/room/SyncBar";
import { useElementSize, usePageKeys, useWakeLock } from "./hooks";

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
};

export function ScoreViewer({ songId, title, url, fileType, pageCount, backHref }: Props) {
  const rt = useRoomRealtime();
  // 새로고침·늦은 입장: 리더의 현재 위치(DB 값)가 이 곡이면 그 쪽에서 시작
  const [page, setPage] = useState(() =>
    rt?.position.songId === songId ? Math.max(1, rt.position.page) : 1,
  );
  const [numPages, setNumPages] = useState(fileType === "pdf" ? pageCount : 1);
  const [boxRef, box] = useElementSize<HTMLDivElement>();
  const wakeLock = useWakeLock();

  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 서버 렌더된 <img>가 하이드레이션 전에 실패하면 onError가 호출되지 않으므로 마운트 시 한 번 확인
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) setImgError(true);
  }, []);

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
  const numPagesRef = useRef(numPages);
  useEffect(() => {
    numPagesRef.current = numPages;
  });
  useEffect(() => {
    if (!subscribe) return;
    return subscribe((pos) => {
      if (pos.songId === songId) setPage(Math.max(1, Math.min(pos.page, numPagesRef.current)));
    });
  }, [subscribe, songId]);

  // 실제 PDF 쪽수가 DB 값과 다르면 실제 값을 따르고, 범위를 넘은 현재 쪽을 당겨온다
  const onNumPages = useCallback((n: number) => {
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
        <div className="flex h-10 shrink-0 items-center border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
          <SyncControls compact />
        </div>
      )}

      {/* 악보 영역: 왼쪽 절반 탭 = 이전, 오른쪽 절반 탭 = 다음 */}
      <div className="relative min-h-0 flex-1 p-2">
        <div ref={boxRef} className="h-full w-full">
          {fileType === "pdf" ? (
            <PdfPages url={url} page={page} box={box} onNumPages={onNumPages} />
          ) : imgError ? (
            <p className="p-6 text-center text-sm text-red-600 dark:text-red-400">
              악보를 불러오지 못했습니다. 새로고침해 보세요.
            </p>
          ) : (
            // 서명 URL은 요청마다 바뀌어 next/image 최적화 대상이 아님
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={title}
              ref={imgRef}
              onError={() => setImgError(true)}
              className="h-full w-full bg-white object-contain"
            />
          )}
        </div>
        {numPages > 1 && (
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

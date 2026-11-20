"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useElementSize, usePageKeys, useWakeLock } from "./hooks";

// pdf.js는 브라우저 API(DOMMatrix 등)를 쓰므로 서버 렌더링에서 제외
const PdfPages = dynamic(() => import("./PdfPages"), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-zinc-500">뷰어 준비 중…</p>,
});

type Props = {
  title: string;
  url: string;
  fileType: "pdf" | "image";
  pageCount: number;
  backHref: string;
};

export function ScoreViewer({ title, url, fileType, pageCount, backHref }: Props) {
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(fileType === "pdf" ? pageCount : 1);
  const [boxRef, box] = useElementSize<HTMLDivElement>();
  const wakeLock = useWakeLock();

  const prev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const next = useCallback(() => setPage((p) => Math.min(numPages, p + 1)), [numPages]);
  usePageKeys(prev, next);

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

      {/* 악보 영역: 왼쪽 절반 탭 = 이전, 오른쪽 절반 탭 = 다음 */}
      <div className="relative min-h-0 flex-1 p-2">
        <div ref={boxRef} className="h-full w-full">
          {fileType === "pdf" ? (
            <PdfPages url={url} page={page} box={box} onNumPages={setNumPages} />
          ) : (
            // 서명 URL은 요청마다 바뀌어 next/image 최적화 대상이 아님
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={title} className="h-full w-full bg-white object-contain" />
          )}
        </div>
        {numPages > 1 && (
          <div className="absolute inset-0 flex" aria-hidden>
            <button type="button" tabIndex={-1} className="h-full w-1/2 cursor-w-resize outline-none" onClick={prev} />
            <button type="button" tabIndex={-1} className="h-full w-1/2 cursor-e-resize outline-none" onClick={next} />
          </div>
        )}
      </div>
    </div>
  );
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
      className="h-9 w-9 rounded-md border border-zinc-300 text-lg leading-none disabled:opacity-30 dark:border-zinc-700"
      {...props}
    >
      {children}
    </button>
  );
}

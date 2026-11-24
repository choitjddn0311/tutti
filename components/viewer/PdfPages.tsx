"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { configurePdfWorker } from "@/lib/pdf";
import { ScoreError } from "./ScoreError";

configurePdfWorker(pdfjs);

type Props = {
  url: string;
  page: number;
  /** 페이지를 맞출 영역 크기(px) */
  box: { width: number; height: number };
  onNumPages: (n: number) => void;
  /** 새 서명 URL로 다시 불러오기 */
  onRetry: () => Promise<boolean>;
  /** 현재 페이지 위에 겹칠 레이어 (섹션·위치 사인). 페이지와 정확히 같은 크기의 상자 안에 그려진다 */
  overlay?: (page: number) => React.ReactNode;
};

/**
 * PDF 렌더링. 현재 페이지와 앞뒤 1쪽을 미리 그려 두어(invisible) 넘김이 즉시 보이게 한다.
 * 각 페이지는 영역 안에 통째로 보이도록(contain) 크기를 맞춘다.
 */
export default function PdfPages({ url, page, box, onNumPages, onRetry, overlay }: Props) {
  const [numPages, setNumPages] = useState(0);
  // 페이지별 가로/세로 비율 (첫 렌더 후 알게 됨). 모르면 A4 비율로 가정.
  const [aspects, setAspects] = useState<Record<number, number>>({});
  const [error, setError] = useState(false);

  if (error) {
    return <ScoreError onRetry={onRetry} />;
  }

  // 실제 쪽수를 알기 전에는 페이지를 그리지 않는다 (DB 쪽수가 틀렸을 때 없는 쪽 요청 → pdf.js 예외 방지).
  // 부모가 page를 당겨오기 전 한 번의 렌더에서도 범위를 넘지 않도록 여기서도 자른다.
  const current = numPages ? Math.min(Math.max(page, 1), numPages) : 0;
  const window3 = numPages
    ? [current - 1, current, current + 1].filter((p) => p >= 1 && p <= numPages)
    : [];

  return (
    <Document
      file={url}
      // react-pdf 11 기본값(suspense)은 실패를 Error Boundary로 던져 앱 전체가 깨진다.
      // false로 두면 loading/error/onLoadError로 처리된다 (자식 Page도 상속).
      suspense={false}
      onLoadSuccess={(pdf) => {
        setNumPages(pdf.numPages);
        onNumPages(pdf.numPages);
      }}
      onLoadError={() => setError(true)}
      loading={<p className="p-6 text-center text-sm text-muted">악보 불러오는 중…</p>}
      className="relative flex h-full w-full items-center justify-center"
    >
      {box.width > 0 && box.height > 0 &&
        window3.map((p) => {
          const aspect = aspects[p] ?? 210 / 297; // width / height
          const fitByHeight = box.width / box.height > aspect;
          return (
            <div
              key={p}
              className={
                p === current
                  ? "relative bg-white"
                  : "pointer-events-none invisible absolute"
              }
              aria-hidden={p !== current}
            >
              <Page
                pageNumber={p}
                {...(fitByHeight ? { height: box.height } : { width: box.width })}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading=""
                onLoadSuccess={(pg) => {
                  const a = pg.originalWidth / pg.originalHeight;
                  setAspects((prev) => (prev[p] === a ? prev : { ...prev, [p]: a }));
                }}
              />
              {p === current && overlay?.(p)}
            </div>
          );
        })}
    </Document>
  );
}

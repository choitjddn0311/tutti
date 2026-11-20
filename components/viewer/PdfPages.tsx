"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { configurePdfWorker } from "@/lib/pdf";

configurePdfWorker(pdfjs);

type Props = {
  url: string;
  page: number;
  /** 페이지를 맞출 영역 크기(px) */
  box: { width: number; height: number };
  onNumPages: (n: number) => void;
};

/**
 * PDF 렌더링. 현재 페이지와 앞뒤 1쪽을 미리 그려 두어(invisible) 넘김이 즉시 보이게 한다.
 * 각 페이지는 영역 안에 통째로 보이도록(contain) 크기를 맞춘다.
 */
export default function PdfPages({ url, page, box, onNumPages }: Props) {
  const [numPages, setNumPages] = useState(0);
  // 페이지별 가로/세로 비율 (첫 렌더 후 알게 됨). 모르면 A4 비율로 가정.
  const [aspects, setAspects] = useState<Record<number, number>>({});
  const [error, setError] = useState(false);

  if (error) {
    return (
      <p className="p-6 text-center text-sm text-red-600 dark:text-red-400">
        악보를 불러오지 못했습니다. 새로고침해 보세요.
      </p>
    );
  }

  const window3 = [page - 1, page, page + 1].filter((p) => p >= 1 && (!numPages || p <= numPages));

  return (
    <Document
      file={url}
      onLoadSuccess={(pdf) => {
        setNumPages(pdf.numPages);
        onNumPages(pdf.numPages);
      }}
      onLoadError={() => setError(true)}
      loading={<p className="p-6 text-center text-sm text-zinc-500">악보 불러오는 중…</p>}
      className="relative flex h-full w-full items-center justify-center"
    >
      {box.width > 0 &&
        window3.map((p) => {
          const aspect = aspects[p] ?? 210 / 297; // width / height
          const fitByHeight = box.width / box.height > aspect;
          return (
            <div
              key={p}
              className={
                p === page
                  ? "relative bg-white shadow-sm"
                  : "pointer-events-none invisible absolute"
              }
              aria-hidden={p !== page}
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
            </div>
          );
        })}
    </Document>
  );
}

"use client";

import type { pdfjs as PdfJs } from "react-pdf";

/**
 * pdf.js 워커 경로 설정. react-pdf가 로드 시 workerSrc를 'pdf.worker.mjs'(상대경로)로
 * 미리 넣으므로 조건 없이 항상 덮어쓴다. 워커는 react-pdf가 쓰는 pdfjs-dist 버전과 같아야 한다.
 */
export function configurePdfWorker(pdfjs: typeof PdfJs) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

/** 브라우저에서 PDF 페이지 수를 센다. pdf.js는 무거우므로 필요할 때만 로드한다. */
export async function countPdfPages(file: File): Promise<number> {
  const { pdfjs } = await import("react-pdf");
  configurePdfWorker(pdfjs);

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  try {
    return (await task.promise).numPages;
  } finally {
    void task.destroy();
  }
}

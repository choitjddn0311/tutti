"use client";

/** 브라우저에서 PDF 페이지 수를 센다. pdf.js는 무거우므로 필요할 때만 로드한다. */
export async function countPdfPages(file: File): Promise<number> {
  const { pdfjs } = await import("react-pdf");
  // react-pdf가 로드 시 workerSrc를 'pdf.worker.mjs'(상대경로)로 미리 넣으므로 항상 덮어쓴다.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  try {
    return (await task.promise).numPages;
  } finally {
    void task.destroy();
  }
}

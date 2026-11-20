/** 업로드 규칙 — 서버·브라우저 공용 (PROJECT.md §4: 파일당 20MB, PDF/PNG/JPEG/WebP). */
export const SCORES_BUCKET = "scores";
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_TITLE_LENGTH = 100;
/** PDF 최대 쪽수 (업로드 검증·현재 페이지 검증 공용) */
export const MAX_PDF_PAGES = 2000;
export const ALLOWED_MIME: Record<string, { type: "pdf" | "image"; ext: string }> = {
  "application/pdf": { type: "pdf", ext: "pdf" },
  "image/png": { type: "image", ext: "png" },
  "image/jpeg": { type: "image", ext: "jpg" },
  "image/webp": { type: "image", ext: "webp" },
};
export const ACCEPT_ATTR = Object.keys(ALLOWED_MIME).join(",");

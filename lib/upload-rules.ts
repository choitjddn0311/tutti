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

/** 섹션 라벨 최대 길이 (서버·브라우저 공용) */
export const MAX_SECTION_LABEL = 20;
/** 텍스트 메시지 최대 길이 */
export const MAX_MESSAGE_LENGTH = 60;
/** 프리셋 큐 (PROJECT.md 확정, 2026-11-21) */
export const PRESET_CUES = ["처음으로", "한 번 더", "엔딩", "스톱"] as const;

/** 3시간 — 이보다 오래된 리더 위치는 지난 합주로 본다 (2026-11-24 사용자 결정) */
export const POSITION_TTL_MS = 3 * 60 * 60 * 1000;

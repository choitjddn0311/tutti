/** 공용 스타일 (디자인 시스템 E: Blackout Stage). 모양이 반복되는 요소만 모은다. */

/** 기본 버튼: 흰 면 + 검정 글자 알약 */
export const btnPrimary =
  "inline-flex h-12 items-center justify-center rounded-full bg-fg px-6 text-[15px] font-bold text-canvas transition active:scale-[0.98] disabled:opacity-40";

/** 보조 버튼: 흰 외곽선 알약 */
export const btnOutline =
  "inline-flex h-11 items-center justify-center rounded-full border border-fg px-5 text-sm font-semibold text-fg transition active:scale-[0.98] disabled:opacity-40";

/** 원형 아이콘 버튼 (어두운 면) */
export const btnIcon =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-raised text-fg transition active:scale-95 disabled:opacity-30";

/** 입력 칸 */
export const field =
  "h-12 w-full rounded-full border border-line bg-canvas px-5 text-base text-fg outline-none placeholder:text-muted focus:border-fg";

/** 카드(패널) */
export const card = "rounded-[20px] bg-surface p-5";

/** 글래스 칩 (악보 위 이름표·섹션 라벨) */
export const glassChip = "glass rounded-full bg-black/55 text-white";

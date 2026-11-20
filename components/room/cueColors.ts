/** 프리셋 큐 색 — 악보 아래 큐 버튼과 알림 배너가 같은 색을 쓰도록 한 곳에서 관리 (큐만 유일하게 색을 쓴다) */
export const CUE_COLOR: Record<string, string> = {
  스톱: "bg-cue-stop",
  엔딩: "bg-cue-end",
  처음으로: "bg-cue-start",
  "한 번 더": "bg-cue-again",
};

/** 악보 위에 뜨는 큐 배너용 반투명(글래스) 배경 — 악보가 비쳐 보이게 */
export const CUE_GLASS: Record<string, string> = {
  스톱: "bg-cue-stop/65",
  엔딩: "bg-cue-end/65",
  처음으로: "bg-cue-start/65",
  "한 번 더": "bg-cue-again/65",
};

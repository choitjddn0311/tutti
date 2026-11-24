"use client";

import { useState } from "react";
import { btnOutline } from "@/components/ui";

/** 악보 로드 실패 안내. onRetry는 새 서명 URL로 다시 불러오기에 성공하면 true */
export function ScoreError({ onRetry }: { onRetry: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    // z-10: 악보 위 좌우 넘김 탭 영역보다 위에 있어야 버튼이 눌린다
    <div className="relative z-10 flex flex-col items-center gap-4 p-6 text-center text-sm text-danger">
      <p>
        악보를 불러오지 못했습니다.
        {failed && " 연결을 확인하고 다시 시도하세요."}
      </p>
      <button
        type="button"
        className={btnOutline}
        disabled={busy}
        onMouseDown={(e) => e.preventDefault()}
        onClick={async () => {
          setBusy(true);
          const ok = await onRetry();
          setFailed(!ok);
          setBusy(false);
        }}
      >
        {busy ? "불러오는 중…" : "다시 시도"}
      </button>
    </div>
  );
}

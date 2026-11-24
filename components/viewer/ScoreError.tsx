"use client";

import { useRouter } from "next/navigation";
import { btnOutline } from "@/components/ui";

/** 악보 로드 실패 안내. 다시 시도하면 서명 URL을 새로 받는다 (만료·네트워크 끊김 모두 복구, 실시간 연결·현재 쪽은 유지) */
export function ScoreError({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  return (
    // z-10: 악보 위 좌우 넘김 탭 영역보다 위에 있어야 버튼이 눌린다
    <div className="relative z-10 flex flex-col items-center gap-4 p-6 text-center text-sm text-danger">
      <p>악보를 불러오지 못했습니다.</p>
      <button
        type="button"
        className={btnOutline}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onRetry();
          router.refresh();
        }}
      >
        다시 시도
      </button>
    </div>
  );
}

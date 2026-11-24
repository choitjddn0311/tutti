"use client";

import { useEffect, useRef, useState } from "react";
import { ScoreError } from "./ScoreError";

/**
 * 이미지 악보 1쪽. 영역 안에 비율을 유지해 통째로 맞추고(contain),
 * 이미지와 정확히 같은 크기의 상자에 overlay를 겹친다 → 화면 크기가 달라도 정규화 좌표가 같은 위치.
 */
export function ImagePage({
  url,
  alt,
  box,
  overlay,
}: {
  url: string;
  alt: string;
  box: { width: number; height: number };
  overlay?: React.ReactNode;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState(false);

  // 서버 렌더된 <img>가 하이드레이션 전에 로드/실패하면 이벤트를 놓치므로 마운트 시 한 번 확인
  useEffect(() => {
    const img = imgRef.current;
    if (!img?.complete) return;
    if (img.naturalWidth === 0) setError(true);
    else setNatural({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  if (error) {
    return <ScoreError onRetry={() => setError(false)} />;
  }

  let size: { width: number; height: number } | undefined;
  if (natural && box.width > 0 && box.height > 0) {
    const scale = Math.min(box.width / natural.w, box.height / natural.h);
    size = { width: Math.floor(natural.w * scale), height: Math.floor(natural.h * scale) };
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative bg-white" style={size ?? { width: "100%", height: "100%" }}>
        {/* 서명 URL은 요청마다 바뀌어 next/image 최적화 대상이 아님 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={url}
          alt={alt}
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          onError={() => setError(true)}
          className="block h-full w-full object-contain"
        />
        {size && overlay}
      </div>
    </div>
  );
}

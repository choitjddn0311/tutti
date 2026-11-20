"use client";

import { useEffect, useRef, useState } from "react";

/** 요소의 콘텐츠 영역 크기(px). 화면 회전·창 크기 변경에 반응한다. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
}

/**
 * 합주 중 화면 꺼짐 방지 (Screen Wake Lock API).
 * 탭이 백그라운드로 가면 브라우저가 해제하므로 다시 보일 때 재요청한다.
 * 미지원 브라우저에서는 false를 돌려준다.
 */
export function useWakeLock(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let pending = false; // 요청 중복 방지 (최초 요청과 visibilitychange가 겹칠 때)
    let cancelled = false;

    async function acquire() {
      if (document.visibilityState !== "visible" || sentinel || pending) return;
      pending = true;
      try {
        const s = await navigator.wakeLock.request("screen");
        if (cancelled || sentinel) {
          void s.release();
          return;
        }
        sentinel = s;
        setActive(true);
        s.addEventListener("release", () => {
          sentinel = null;
          setActive(false);
        });
      } catch {
        setActive(false); // 권한 거부·절전 모드 등
      } finally {
        pending = false;
      }
    }

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release();
    };
  }, []);

  return active;
}

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " "]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp"]);

/** 키보드·블루투스 페달 입력 (페달은 보통 화살표 또는 PageUp/PageDown 키를 보낸다). */
export function usePageKeys(onPrev: () => void, onNext: () => void) {
  const handlers = useRef({ onPrev, onNext });
  useEffect(() => {
    handlers.current = { onPrev, onNext };
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (NEXT_KEYS.has(e.key)) {
        e.preventDefault();
        handlers.current.onNext();
      } else if (PREV_KEYS.has(e.key)) {
        e.preventDefault();
        handlers.current.onPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { setPosition } from "@/app/actions/position";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { MAX_MESSAGE_LENGTH, PRESET_CUES } from "@/lib/upload-rules";
import { RoomNotices } from "./RoomNotices";

/**
 * Presence에 싣는 내 정보. Supabase Realtime은 클라이언트당 Presence 갱신을 30초에 5회로 제한하고
 * 넘으면 채널을 닫는다 → 자주 바뀌는 값(현재 페이지 등)은 절대 Presence에 싣지 않는다.
 */
export type Member = {
  clientId: string;
  nickname: string;
  instrument: string;
  /**
   * 리더 차수. 리더를 맡을 때 (지금까지 본 최대 + 1), null = 리더 아님.
   * 시각 대신 차수를 써서 기기 간 시계 차이에 영향받지 않는다.
   */
  epoch: number | null;
};

export type Position = { songId: string | null; page: number };
/**
 * 리더가 알린 위치. (epoch, seq)로 순서를 매겨 늦게 도착한 옛 값을 버린다.
 * seq는 리더 기기에서 계속 증가하는 값(같은 리더 안에서만 비교하므로 기기 간 시계 차이와 무관).
 */
type LeaderPos = { songId: string; page: number; epoch: number; seq: number };
type PositionEvent = LeaderPos & { from: string };
type PositionListener = (pos: { songId: string; page: number }) => void;

/** 화면에 잠깐 띄우는 알림: 프리셋 큐·텍스트 메시지·(다른 쪽/곡의) 위치 사인 */
export type Notice = {
  id: string;
  kind: "cue" | "message" | "point";
  from: string; // 닉네임
  text: string;
  songId?: string;
  page?: number;
};
/** 악보 위 위치 사인 (페이지 기준 0~1 정규화 좌표) */
export type PointSignal = { id: string; from: string; songId: string; page: number; x: number; y: number };
/** 그렸으면 true (같은 곡·쪽을 보고 있을 때) */
type PointListener = (p: PointSignal) => boolean;
type SectionsListener = (songId: string) => void;

const NOTICE_MS = { cue: 3500, message: 6000, point: 4000 } as const;
const isUnit = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

function isNewer(a: { epoch: number; seq: number }, b: { epoch: number; seq: number }) {
  return a.epoch > b.epoch || (a.epoch === b.epoch && a.seq > b.seq);
}

function isPositionEvent(p: unknown): p is PositionEvent {
  const x = p as PositionEvent | null;
  return (
    !!x &&
    typeof x.songId === "string" &&
    Number.isInteger(x.page) &&
    x.page >= 1 &&
    typeof x.epoch === "number" &&
    typeof x.seq === "number" &&
    typeof x.from === "string"
  );
}

type RoomRealtime = {
  code: string;
  me: Member;
  members: Member[];
  leader: Member | null;
  isLeader: boolean;
  connected: boolean;
  follow: boolean;
  setFollow: (on: boolean) => void;
  takeLead: () => void;
  releaseLead: () => void;
  /** 리더의 현재 위치 (초기값은 DB, 이후 리더 broadcast로 갱신) */
  position: Position;
  /** 리더만 호출: 내 위치를 모두에게 알리고 DB에 저장 */
  publishPosition: (songId: string, page: number) => void;
  /** 곡 삭제 후 호출: 그 곡을 가리키는 위치를 잊는다 */
  forgetSong: (songId: string) => void;
  /**
   * 따라가기 중 리더 위치로 맞춰야 할 때 호출되는 콜백 등록 (뷰어가 페이지를 맞춤).
   * 다른 곡으로의 이동은 Provider가 직접 처리한다.
   */
  subscribePosition: (cb: PositionListener) => () => void;

  // ---------- 5단계: 사인 ----------
  notices: Notice[];
  dismissNotice: (id: string) => void;
  /** 알림에서 곡 열기 */
  openSong: (songId: string) => void;
  sendCue: (cue: string) => void;
  sendMessage: (text: string) => void;
  /** 악보 위치 사인 (모두의 화면에 같은 위치로 표시) */
  sendPoint: (songId: string, page: number, x: number, y: number) => void;
  subscribePoints: (cb: PointListener) => () => void;
  /** 섹션을 추가·삭제했음을 알림 → 그 곡을 보는 사람이 다시 불러옴 */
  notifySectionsChanged: (songId: string) => void;
  subscribeSections: (cb: SectionsListener) => () => void;
};

const Ctx = createContext<RoomRealtime | null>(null);

/** Provider 밖(미입장 화면 등)에서는 null */
export function useRoomRealtime(): RoomRealtime | null {
  return use(Ctx);
}

const PERSIST_DELAY = 400; // ms — 빠른 연속 넘김은 마지막 위치만 저장
const RECONNECT_DELAY = 2000; // ms — 서버가 채널을 닫았을 때 재연결 대기
const NAV_RETRY_MS = 3000; // ms — 같은 곡으로의 이동을 다시 시도하기까지

// ---------- 브라우저 저장소 (편의 기능이므로 실패해도 무시) ----------
function storageGet(kind: "local" | "session", key: string): string | null {
  try {
    return (kind === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function storageSet(kind: "local" | "session", key: string, value: string | null) {
  try {
    const s = kind === "local" ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // 사생활 보호 모드 등
  }
}

// 따라가기 설정 (기기별, localStorage). useSyncExternalStore로 서버 렌더와 어긋나지 않게 읽는다.
const FOLLOW_EVENT = "tutti:follow";
function subscribeFollow(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(FOLLOW_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(FOLLOW_EVENT, cb);
  };
}

/**
 * 채널 제거가 진행 중인 토픽 → 완료 Promise.
 * supabase.channel()은 같은 토픽의 채널이 목록에 남아 있으면 그 객체를 그대로 돌려주는데,
 * removeChannel은 서버 응답 후에야 목록에서 빠진다. 다시 연결할 때 닫히는 중인 옛 채널을 받지 않도록
 * 제거가 끝난 뒤에 새 채널을 만든다.
 */
const removing = new Map<string, Promise<unknown>>();

function newClientId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 리더 = epoch가 가장 큰 참가자 (같으면 clientId가 큰 쪽) */
function pickLeader(members: Member[]): Member | null {
  let best: Member | null = null;
  for (const m of members) {
    if (m.epoch === null) continue;
    if (
      !best ||
      m.epoch > (best.epoch as number) ||
      (m.epoch === best.epoch && m.clientId > best.clientId)
    ) {
      best = m;
    }
  }
  return best;
}

/** Presence 목록의 내 항목은 서버 반영 전일 수 있으므로 최신 내 정보로 바꿔 계산 */
function withMe(members: Member[], me: Member): Member[] {
  return [...members.filter((m) => m.clientId !== me.clientId), me];
}

export function RoomRealtimeProvider({
  code,
  roomId,
  nickname,
  instrument,
  initialPosition,
  children,
}: {
  code: string;
  roomId: string;
  nickname: string;
  instrument: string;
  initialPosition: Position;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const epochKey = `tutti:${roomId}:epoch`;
  const seqKey = `tutti:${roomId}:seq`;
  const followKey = `tutti:${roomId}:follow`;

  // 접속 식별자는 페이지 로드마다 새로 만든다 (탭 복제 시 sessionStorage가 복사되어 같은 ID가 둘 생기는 것 방지).
  // 리더 차수만 sessionStorage에 두어 리더가 새로고침해도 리더를 유지한다.
  const [clientId] = useState(() => (typeof window === "undefined" ? "" : newClientId()));
  const [epoch, setEpochState] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = storageGet("session", epochKey);
    return v ? Number(v) : null;
  });

  /** 리더로서 마지막으로 알린 위치 — 늦게 들어온 사람의 요청(position_request)에 답할 때 쓴다 */
  const myPos = useRef<LeaderPos | null>(null);

  /** 리더 차수 변경. 리더를 잃거나 새로 맡으면 예전 위치는 버린다 (다시 맡을 때 옛 위치로 끌고 가지 않게) */
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 아직 저장 안 된 리더 위치: 직접 내려놓으면 바로 저장, 다른 사람이 리더를 가져가면 버린다 */
  const pendingPersist = useRef<(() => void) | null>(null);

  const setEpoch = useCallback(
    (v: number | null, opts?: { flush?: boolean }) => {
      setEpochState(v);
      myPos.current = null;
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
        // 다른 사람이 리더를 가져간 경우엔 버린다 (새 리더의 위치를 옛 위치로 덮어쓰지 않게)
        if (opts?.flush) pendingPersist.current?.();
      }
      pendingPersist.current = null;
      storageSet("session", epochKey, v === null ? null : String(v));
    },
    [epochKey],
  );

  const follow = useSyncExternalStore(
    subscribeFollow,
    () => storageGet("local", followKey) !== "0",
    () => true, // 서버 렌더 기본값: 따라가기
  );

  const [members, setMembers] = useState<Member[]>([]);
  const [connected, setConnected] = useState(false);
  const [position, setPositionState] = useState<Position>(initialPosition);
  /** 서버가 채널을 닫으면 증가 → 채널 effect가 다시 연결 */
  const [reconnectTick, setReconnectTick] = useState(0);

  const me: Member = useMemo(
    () => ({ clientId, nickname, instrument, epoch }),
    [clientId, nickname, instrument, epoch],
  );
  // 연결 전(서버 렌더·하이드레이션 포함)에는 리더를 표시하지 않는다.
  // sessionStorage의 리더 차수가 첫 렌더에 반영되면 서버 HTML과 달라져 하이드레이션 오류가 난다.
  const leader = useMemo(
    () => (connected ? pickLeader(withMe(members, me)) : null),
    [connected, members, me],
  );
  const isLeader = !!leader && leader.clientId === clientId;

  // 콜백(채널 이벤트 등)에서 최신 값을 읽기 위한 ref
  const latest = useRef({ me, follow, isLeader, leaderId: leader?.clientId, position, pathname });
  useEffect(() => {
    latest.current = { me, follow, isLeader, leaderId: leader?.clientId, position, pathname };
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  /** 마지막으로 반영한 리더 위치의 순서 (초기 DB 값은 가장 오래된 것으로 취급) */
  const knownOrder = useRef({ epoch: -1, seq: -1 });
  /** 지금까지 본 가장 큰 리더 차수 — 리더를 맡을 때 이보다 크게 잡아야 따라가는 사람이 옛 리더로 취급하지 않는다 */
  const maxEpochSeen = useRef(0);
  /** 이동 중인 목적지 (같은 곳으로 router.push 중복 방지) */
  const pendingNav = useRef<{ target: string; at: number } | null>(null);
  /** 현재 리더의 차수 — 리더의 clientId가 바뀌어도 차수가 같으면 같은 리더(새로고침)로 본다 */
  const leaderEpoch = useRef<number | null>(null);
  const listeners = useRef(new Set<PositionListener>());

  /**
   * 리더에게서 받은 위치를 반영. 맞춰야 하면(위치가 바뀌었거나 처음 받은 값) true.
   * 더 오래된 값이거나 위치가 같으면 false — 다른 사람의 입장 요청에 리더가 답한 것만으로
   * 셋리스트에 나가 있던 사람을 끌고 가지 않게.
   */
  const acceptLeaderPos = useCallback((p: LeaderPos) => {
    maxEpochSeen.current = Math.max(maxEpochSeen.current, p.epoch);
    if (!isNewer(p, knownOrder.current)) return false;
    const first = knownOrder.current.epoch < 0;
    knownOrder.current = { epoch: p.epoch, seq: p.seq };
    const prev = latest.current.position;
    const changed = prev.songId !== p.songId || prev.page !== p.page;
    if (changed) {
      const pos = { songId: p.songId, page: p.page };
      latest.current.position = pos;
      setPositionState(pos);
    }
    return first || changed;
  }, []);

  /**
   * 따라가기 중이면 리더 위치(position)로 맞춘다: 다른 곡이면 이동, 같은 곡이면 뷰어에 알림.
   * 호출하는 쪽이 position을 리더에게서 받은 값으로 갱신한 뒤 부른다.
   * (리더가 새로고침하면 Presence 재입장보다 broadcast가 먼저 올 수 있어 리더 확인은 하지 않는다)
   */
  const syncToLeader = useCallback(() => {
    const { follow, isLeader, position, pathname } = latest.current;
    // 리더에게서 받은 위치가 없으면(초기 DB 값뿐) 움직이지 않는다 — 지난 합주 위치로 끌려가지 않게
    if (!follow || isLeader || !position.songId || knownOrder.current.epoch < 0) return;
    const pos = { songId: position.songId, page: position.page };
    const target = `/room/${code}/song/${pos.songId}`;
    const pending = pendingNav.current;
    // 같은 곳으로 이동 중이면 다시 push하지 않음. 단, 이동이 실패·되돌아온 경우를 위해 3초 지나면 다시 시도
    if (pathname !== target && !(pending?.target === target && Date.now() - pending.at < NAV_RETRY_MS)) {
      pendingNav.current = { target, at: Date.now() };
      router.push(target);
    }
    listeners.current.forEach((cb) => cb(pos));
  }, [code, router]);

  // 이동이 끝나면 대기 중인 목적지를 비운다
  useEffect(() => {
    pendingNav.current = null;
  }, [pathname]);

  const sendBroadcast = useCallback((event: string, payload: object) => {
    void channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  /** 리더 위치를 알려 달라고 요청 (입장 직후·리더가 바뀌었을 때). 리더가 곡을 열어 둔 경우에만 답이 온다 */
  const requestPosition = useCallback(() => {
    sendBroadcast("position_request", { from: latest.current.me.clientId });
  }, [sendBroadcast]);

  // ---------- 사인 (휘발성: DB에 저장하지 않음) ----------
  const [notices, setNotices] = useState<Notice[]>([]);
  const pointListeners = useRef(new Set<PointListener>());
  const sectionListeners = useRef(new Set<SectionsListener>());
  const noticeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissNotice = useCallback((id: string) => {
    setNotices((list) => list.filter((n) => n.id !== id));
    const t = noticeTimers.current.get(id);
    if (t) clearTimeout(t);
    noticeTimers.current.delete(id);
  }, []);

  /** 알림 추가. id는 항상 여기서 새로 만든다 (보낸 쪽 id를 쓰면 중복·충돌 시 타이머가 엉킴) */
  const pushNotice = useCallback(
    (data: Omit<Notice, "id">) => {
      const n: Notice = { ...data, id: newClientId() };
      setNotices((list) => {
        // 큐는 한 번에 하나만 크게 (새 큐가 이전 큐를 대체), 최대 5개 유지
        const kept = [...list.filter((x) => n.kind !== "cue" || x.kind !== "cue"), n].slice(-5);
        // 밀려난 알림의 타이머 정리
        for (const old of list) {
          if (!kept.includes(old)) {
            const t = noticeTimers.current.get(old.id);
            if (t) clearTimeout(t);
            noticeTimers.current.delete(old.id);
          }
        }
        return kept;
      });
      noticeTimers.current.set(n.id, setTimeout(() => dismissNotice(n.id), NOTICE_MS[n.kind]));
    },
    [dismissNotice],
  );

  useEffect(() => {
    const timers = noticeTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  /** 받은(또는 내가 보낸) 위치 사인 처리: 같은 곡을 보는 뷰어가 있으면 그리고, 없으면 알림으로 */
  const handlePoint = useCallback(
    (p: PointSignal) => {
      let shown = false;
      pointListeners.current.forEach((cb) => {
        if (cb(p)) shown = true;
      });
      if (!shown) {
        const otherSong = !latest.current.pathname.endsWith(`/song/${p.songId}`);
        pushNotice({
          kind: "point",
          from: p.from,
          text: otherSong ? `다른 곡 ${p.page}쪽 위치 표시 (탭하면 열기)` : `${p.page}쪽 위치 표시`,
          songId: p.songId,
          page: p.page,
        });
      }
    },
    [pushNotice],
  );

  /** 삭제된 곡을 가리키는 위치를 잊는다 (리더면 요청에 답하는 위치도 비움) */
  const forgetLocal = useCallback((songId: string) => {
    if (latest.current.position.songId === songId) {
      latest.current.position = { songId: null, page: 1 };
      setPositionState({ songId: null, page: 1 });
    }
    if (myPos.current?.songId === songId) myPos.current = null;
    if (pendingNav.current?.target.endsWith(`/song/${songId}`)) pendingNav.current = null;
  }, []);

  // ---------- 채널 연결 (채널명은 방 UUID — 입장 인증을 통과해야 알 수 있음) ----------
  useEffect(() => {
    if (!clientId) return;
    const supabase = getBrowserSupabase();
    const topic = `room:${roomId}`;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const onPosition = ({ payload }: { payload: unknown }) => {
      if (!isPositionEvent(payload)) return;
      // 현재 리더가 보낸 것만 받는다. 리더를 아직 모르면(리더 새로고침 직후 Presence보다 먼저 도착) 받는다
      const leaderId = latest.current.leaderId;
      if (leaderId && payload.from !== leaderId) return;
      if (acceptLeaderPos(payload)) syncToLeader();
    };

    const onSongDeleted = ({ payload }: { payload: unknown }) => {
      const songId = (payload as { songId?: unknown } | null)?.songId;
      if (typeof songId === "string") forgetLocal(songId);
    };

    const connect = () => {
      if (cancelled) return;
      const ch = supabase.channel(topic, {
        config: { presence: { key: clientId }, broadcast: { self: false } },
      });
      channel = ch;
      ch.on("presence", { event: "sync" }, () => {
        const list = Object.values(ch.presenceState<Member>())
          .map((metas) => metas[metas.length - 1])
          .filter(Boolean)
          .map(({ clientId, nickname, instrument, epoch }) => ({
            clientId,
            nickname,
            instrument,
            epoch: epoch ?? null,
          }));
        setMembers(list);
        for (const m of list) maxEpochSeen.current = Math.max(maxEpochSeen.current, m.epoch ?? 0);

        const mine = latest.current.me;
        const top = pickLeader(withMe(list, mine));
        // 다른 사람이 더 높은 차수로 리더를 맡았으면 내 리더 표시를 내린다.
        // 차수가 같은 경우(탭 복제·새로고침 직후 남은 옛 접속)는 내리지 않고 clientId 순서로 한 명만 리더로 동작한다.
        if (mine.epoch !== null && top && top.clientId !== mine.clientId && (top.epoch as number) > mine.epoch) {
          setEpoch(null);
        }
        const prevLeader = latest.current.leaderId;
        const prevLeaderEpoch = leaderEpoch.current;
        // 리더가 잠깐 사라져도(새로고침: 나갔다 다시 들어옴) 마지막 리더 차수는 기억한다
        if (top) leaderEpoch.current = top.epoch;
        latest.current.leaderId = top?.clientId;
        latest.current.isLeader = top?.clientId === mine.clientId && mine.epoch !== null;
        // 리더가 다른 사람으로 바뀌면(늦은 입장 포함) 순서 기록을 새 리더 기준으로 다시 시작하고 현재 위치를 요청한다.
        // 리더 차수는 기기마다 본 범위가 달라 새 리더가 예전 리더보다 작은 차수를 가질 수 있기 때문.
        // 단, 차수가 같으면 같은 리더가 새로고침해 다시 들어온 것이므로 순서 기록을 유지한다
        // (초기화하면 셋리스트로 나가 있던 사람까지 다시 끌고 간다).
        if (top && top.clientId !== mine.clientId && top.clientId !== prevLeader) {
          if (top.epoch !== prevLeaderEpoch) knownOrder.current = { epoch: -1, seq: -1 };
          requestPosition();
        }
      })
        .on("broadcast", { event: "page_change" }, onPosition)
        .on("broadcast", { event: "song_change" }, onPosition)
        .on("broadcast", { event: "song_deleted" }, onSongDeleted)
        .on("broadcast", { event: "signal" }, ({ payload }) => {
          const p = payload as Record<string, unknown> | null;
          const from = typeof p?.from === "string" ? p.from.slice(0, 20) : "";
          if (p?.kind === "cue" && typeof p.text === "string" && (PRESET_CUES as readonly string[]).includes(p.text)) {
            pushNotice({ kind: "cue", from, text: p.text });
          } else if (
            p?.kind === "point" &&
            typeof p.songId === "string" &&
            Number.isInteger(p.page) &&
            (p.page as number) >= 1 &&
            isUnit(p.x) &&
            isUnit(p.y)
          ) {
            // id는 받는 쪽에서 새로 만든다 (보낸 쪽 값 중복 시 React key·타이머 충돌 방지)
            handlePoint({ id: newClientId(), from, songId: p.songId, page: p.page as number, x: p.x, y: p.y });
          }
        })
        .on("broadcast", { event: "message" }, ({ payload }) => {
          const p = payload as Record<string, unknown> | null;
          const text = typeof p?.text === "string" ? p.text.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
          if (!text) return;
          const from = typeof p?.from === "string" ? p.from.slice(0, 20) : "";
          pushNotice({ kind: "message", from, text });
        })
        .on("broadcast", { event: "sections_changed" }, ({ payload }) => {
          const songId = (payload as { songId?: unknown } | null)?.songId;
          if (typeof songId === "string") sectionListeners.current.forEach((cb) => cb(songId));
        })
        .on("broadcast", { event: "position_request" }, () => {
          // 리더만 답한다. 같은 순서 번호로 다시 보내므로 이미 맞춰진 사람에게는 영향 없음
          const pos = myPos.current;
          if (latest.current.isLeader && pos) {
            sendBroadcast("page_change", { ...pos, from: latest.current.me.clientId });
          }
        })
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            // track은 아래 [me, connected] effect 한 곳에서만 (Presence 갱신 제한 30초 5회)
            setConnected(true);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            // 서버가 채널을 닫았거나 연결 오류 → 잠시 후 새 채널로 다시 연결
            setConnected(false);
            if (!retryTimer) {
              retryTimer = setTimeout(() => setReconnectTick((n) => n + 1), RECONNECT_DELAY);
            }
          }
        });
      channelRef.current = ch;
    };

    const prev = removing.get(topic);
    if (prev) void prev.finally(connect);
    else connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      channelRef.current = null;
      setConnected(false);
      if (channel) {
        const p = supabase.removeChannel(channel).catch(() => {});
        removing.set(topic, p);
        void p.finally(() => {
          if (removing.get(topic) === p) removing.delete(topic);
        });
      }
    };
  }, [roomId, clientId, reconnectTick, setEpoch, syncToLeader, acceptLeaderPos, requestPosition, sendBroadcast, forgetLocal, pushNotice, handlePoint]);

  // 내 정보(이름·리더 차수)가 바뀔 때만 다시 track — 자주 부르면 Presence 갱신 제한(30초 5회)에 걸린다
  useEffect(() => {
    if (connected) void channelRef.current?.track(me);
  }, [me, connected]);

  const takeLead = useCallback(() => {
    const max = members.reduce(
      (m, x) => Math.max(m, x.epoch ?? 0),
      Math.max(epoch ?? 0, maxEpochSeen.current, knownOrder.current.epoch),
    );
    maxEpochSeen.current = max + 1;
    setEpoch(max + 1);
  }, [members, epoch, setEpoch]);

  const releaseLead = useCallback(() => setEpoch(null, { flush: true }), [setEpoch]);

  const setFollow = useCallback(
    (on: boolean) => {
      storageSet("local", followKey, on ? null : "0");
      window.dispatchEvent(new Event(FOLLOW_EVENT));
      if (on) {
        latest.current.follow = true;
        syncToLeader(); // 다시 켜면 바로 리더 위치로
      }
    },
    [followKey, syncToLeader],
  );

  const publishPosition = useCallback(
    (songId: string, page: number) => {
      const myEpoch = latest.current.me.epoch;
      if (myEpoch === null) return;
      const prev = latest.current.position;
      // '같은 위치'는 이번 리더 임기에 내가 이미 알린 위치인지로 판단한다.
      // 내가 알고 있는 위치(DB·이전 리더 값)와 같아도 따라가는 사람들은 모를 수 있다.
      const mine = myPos.current;
      const same = !!mine && mine.epoch === myEpoch && mine.songId === songId && mine.page === page;
      // seq는 이 기기에서 계속 증가해야 한다 (시계가 뒤로 가도, 새로고침해도) → sessionStorage에 마지막 값 보관
      const lastSeq = Number(storageGet("session", seqKey) ?? 0) || 0;
      const order = {
        epoch: myEpoch,
        seq: Math.max(Date.now(), lastSeq + 1, knownOrder.current.seq + 1),
      };
      storageSet("session", seqKey, String(order.seq));
      knownOrder.current = order;
      // 위치가 같아도(새로고침 직후·리더 맡은 직후) 요청에 답할 수 있도록 내 위치는 기억한다
      const leaderPos: LeaderPos = { songId, page, ...order };
      myPos.current = leaderPos;
      if (same) return;
      const pos = { songId, page };
      latest.current.position = pos;
      setPositionState(pos);
      sendBroadcast(prev.songId === songId && mine?.songId === songId ? "page_change" : "song_change", {
        ...leaderPos,
        from: clientId,
      } satisfies PositionEvent);
      if (persistTimer.current) clearTimeout(persistTimer.current);
      const persist = () => void setPosition(code, songId, page);
      pendingPersist.current = persist;
      persistTimer.current = setTimeout(() => {
        persistTimer.current = null;
        pendingPersist.current = null;
        persist();
      }, PERSIST_DELAY);
    },
    [clientId, code, seqKey, sendBroadcast],
  );

  /** 곡 삭제를 모두에게 알리고 내 쪽 위치도 잊는다 */
  const forgetSong = useCallback(
    (songId: string) => {
      forgetLocal(songId);
      sendBroadcast("song_deleted", { songId });
    },
    [forgetLocal, sendBroadcast],
  );

  const subscribePosition = useCallback((cb: PositionListener) => {
    listeners.current.add(cb);
    // 뷰어가 렌더된 뒤 구독(effect)하기 전 사이에 온 리더 이벤트를 놓치지 않도록, 구독 즉시 최신 위치로 맞춘다
    const { follow, isLeader, position } = latest.current;
    if (follow && !isLeader && position.songId && knownOrder.current.epoch >= 0) {
      cb({ songId: position.songId, page: position.page });
    }
    return () => {
      listeners.current.delete(cb);
    };
  }, []);

  const sendCue = useCallback(
    (cue: string) => {
      if (!(PRESET_CUES as readonly string[]).includes(cue)) return;
      // broadcast는 내게 오지 않으므로(self: false) 내 화면에도 직접 띄운다
      pushNotice({ kind: "cue", from: nickname, text: cue });
      sendBroadcast("signal", { kind: "cue", from: nickname, text: cue });
    },
    [nickname, pushNotice, sendBroadcast],
  );

  const sendMessage = useCallback(
    (raw: string) => {
      const text = raw.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!text) return;
      pushNotice({ kind: "message", from: nickname, text });
      sendBroadcast("message", { from: nickname, text });
    },
    [nickname, pushNotice, sendBroadcast],
  );

  const sendPoint = useCallback(
    (songId: string, page: number, x: number, y: number) => {
      if (!isUnit(x) || !isUnit(y) || !Number.isInteger(page) || page < 1) return;
      const signal: PointSignal = { id: newClientId(), from: nickname, songId, page, x, y };
      handlePoint(signal);
      sendBroadcast("signal", { kind: "point", ...signal });
    },
    [nickname, handlePoint, sendBroadcast],
  );

  /** 뷰어가 등록: 이 곡·쪽이면 그리고 true를 돌려준다 (그리지 못하면 알림으로 표시됨) */
  const subscribePoints = useCallback((cb: PointListener) => {
    pointListeners.current.add(cb);
    return () => {
      pointListeners.current.delete(cb);
    };
  }, []);

  const notifySectionsChanged = useCallback(
    (songId: string) => sendBroadcast("sections_changed", { songId }),
    [sendBroadcast],
  );

  const subscribeSections = useCallback((cb: SectionsListener) => {
    sectionListeners.current.add(cb);
    return () => {
      sectionListeners.current.delete(cb);
    };
  }, []);

  const value: RoomRealtime = {
    code,
    me,
    members,
    leader,
    isLeader,
    connected,
    follow,
    setFollow,
    takeLead,
    releaseLead,
    position,
    publishPosition,
    forgetSong,
    subscribePosition,
    notices,
    dismissNotice,
    openSong: (songId: string) => router.push(`/room/${code}/song/${songId}`),
    sendCue,
    sendMessage,
    sendPoint,
    subscribePoints,
    notifySectionsChanged,
    subscribeSections,
  };

  return (
    <Ctx value={value}>
      {children}
      <RoomNotices />
    </Ctx>
  );
}

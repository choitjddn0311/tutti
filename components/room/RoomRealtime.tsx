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

export type Member = {
  clientId: string;
  nickname: string;
  instrument: string;
  /**
   * 리더 차수. 리더를 맡을 때 (현재 최대 + 1), null = 리더 아님.
   * 시각 대신 차수를 써서 기기 간 시계 차이에 영향받지 않는다.
   */
  epoch: number | null;
  /** 리더의 현재 위치 (리더일 때만). 늦은 입장·리더 교체 시 오래된 DB 값 대신 이것으로 맞춘다 */
  pos: LeaderPos | null;
};

export type Position = { songId: string | null; page: number };
/**
 * 리더가 알린 위치. (epoch, seq)로 순서를 매겨 broadcast·Presence 중 늦게 도착한 옛 값을 버린다.
 * seq는 리더 기기의 발신 시각(같은 리더 안에서만 비교하므로 기기 간 시계 차이와 무관).
 */
type LeaderPos = { songId: string; page: number; epoch: number; seq: number };
type PositionEvent = LeaderPos & { from: string };

function isNewer(a: { epoch: number; seq: number }, b: { epoch: number; seq: number }) {
  return a.epoch > b.epoch || (a.epoch === b.epoch && a.seq > b.seq);
}
type PositionListener = (pos: { songId: string; page: number }) => void;

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
  /**
   * 따라가기 중 리더 위치로 맞춰야 할 때 호출되는 콜백 등록 (뷰어가 페이지를 맞춤).
   * 다른 곡으로의 이동은 Provider가 직접 처리한다.
   */
  subscribePosition: (cb: PositionListener) => () => void;
};

const Ctx = createContext<RoomRealtime | null>(null);

/** Provider 밖(미입장 화면 등)에서는 null */
export function useRoomRealtime(): RoomRealtime | null {
  return use(Ctx);
}

const PERSIST_DELAY = 400; // ms — 빠른 연속 넘김은 마지막 위치만 저장

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
  const keys = {
    client: `tutti:${roomId}:client`,
    epoch: `tutti:${roomId}:epoch`,
    follow: `tutti:${roomId}:follow`,
  };

  // 탭 단위 식별자·리더 차수 — sessionStorage라 새로고침해도 유지(리더가 새로고침해도 리더 유지)
  const [clientId] = useState(() => {
    if (typeof window === "undefined") return "";
    const saved = storageGet("session", keys.client);
    if (saved) return saved;
    const id = newClientId();
    storageSet("session", keys.client, id);
    return id;
  });
  const [epoch, setEpochState] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = storageGet("session", keys.epoch);
    return v ? Number(v) : null;
  });
  const setEpoch = useCallback(
    (v: number | null) => {
      setEpochState(v);
      storageSet("session", `tutti:${roomId}:epoch`, v === null ? null : String(v));
    },
    [roomId],
  );

  const follow = useSyncExternalStore(
    subscribeFollow,
    () => storageGet("local", keys.follow) !== "0",
    () => true, // 서버 렌더 기본값: 따라가기
  );

  const [members, setMembers] = useState<Member[]>([]);
  const [connected, setConnected] = useState(false);
  const [position, setPositionState] = useState<Position>(initialPosition);

  // 리더로서 마지막으로 알린 위치 (Presence에 실어 보냄)
  const [myPos, setMyPos] = useState<Member["pos"]>(null);
  const me: Member = useMemo(
    () => ({ clientId, nickname, instrument, epoch, pos: epoch !== null ? myPos : null }),
    [clientId, nickname, instrument, epoch, myPos],
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

  /**
   * 리더에게서 받은 위치를 반영. 맞춰야 하면(위치가 바뀌었거나 처음 받은 값) true.
   * 더 오래된 값이거나 위치가 같으면 false — 리더가 새로고침만 했을 때 셋리스트에 있던 사람을 끌고 가지 않게.
   */
  const acceptLeaderPos = useCallback((p: LeaderPos) => {
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
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeners = useRef(new Set<PositionListener>());

  /**
   * 따라가기 중이면 리더 위치(position)로 맞춘다: 다른 곡이면 이동, 같은 곡이면 뷰어에 알림.
   * 호출하는 쪽이 position을 리더에게서 받은 값으로 갱신한 뒤 부른다.
   * (리더가 새로고침하면 Presence 재입장보다 broadcast가 먼저 올 수 있어 리더 확인은 하지 않는다)
   */
  const syncToLeader = useCallback(() => {
    const { follow, isLeader, position, pathname } = latest.current;
    if (!follow || isLeader || !position.songId) return;
    const pos = { songId: position.songId, page: position.page };
    const target = `/room/${code}/song/${pos.songId}`;
    if (pathname !== target) router.push(target);
    listeners.current.forEach((cb) => cb(pos));
  }, [code, router]);

  // ---------- 채널 연결 (채널명은 방 UUID — 입장 인증을 통과해야 알 수 있음) ----------
  useEffect(() => {
    if (!clientId) return;
    const supabase = getBrowserSupabase();
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: clientId }, broadcast: { self: false } },
    });

    const onPosition = ({ payload }: { payload: PositionEvent }) => {
      if (
        !payload ||
        typeof payload.songId !== "string" ||
        !Number.isInteger(payload.page) ||
        typeof payload.epoch !== "number" ||
        typeof payload.seq !== "number"
      ) {
        return;
      }
      if (acceptLeaderPos(payload)) syncToLeader();
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const list = Object.values(channel.presenceState<Member>())
          .map((metas) => metas[metas.length - 1])
          .filter(Boolean)
          .map(({ clientId, nickname, instrument, epoch, pos }) => ({
            clientId,
            nickname,
            instrument,
            epoch: epoch ?? null,
            pos: pos ?? null,
          }));
        setMembers(list);

        const mine = latest.current.me;
        const top = pickLeader(withMe(list, mine));
        // 다른 사람이 더 높은 차수로 리더를 맡았으면 내 리더 표시를 내린다
        if (mine.epoch !== null && top && top.clientId !== mine.clientId) setEpoch(null);
        // 리더의 Presence 위치가 내가 아는 위치와 다르면 맞춘다 (늦은 입장·리더 교체·broadcast 유실 대비).
        // 리더가 아직 아무 곡도 열지 않았으면(pos 없음) 움직이지 않는다 — 오래된 DB 위치로 끌려가지 않게.
        latest.current.leaderId = top?.clientId;
        latest.current.isLeader = top?.clientId === mine.clientId && mine.epoch !== null;
        if (top && top.clientId !== mine.clientId && top.pos && acceptLeaderPos(top.pos)) {
          syncToLeader();
        }
      })
      .on("broadcast", { event: "page_change" }, onPosition)
      .on("broadcast", { event: "song_change" }, onPosition)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          void channel.track(latest.current.me);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [roomId, clientId, setEpoch, syncToLeader, acceptLeaderPos]);

  // 내 정보(리더 차수)가 바뀌면 다시 track
  useEffect(() => {
    if (connected) void channelRef.current?.track(me);
  }, [me, connected]);

  const takeLead = useCallback(() => {
    const max = members.reduce((m, x) => Math.max(m, x.epoch ?? 0), epoch ?? 0);
    setEpoch(max + 1);
  }, [members, epoch, setEpoch]);

  const releaseLead = useCallback(() => {
    setEpoch(null);
    setMyPos(null);
  }, [setEpoch]);

  const setFollow = useCallback(
    (on: boolean) => {
      storageSet("local", `tutti:${roomId}:follow`, on ? null : "0");
      window.dispatchEvent(new Event(FOLLOW_EVENT));
      if (on) {
        latest.current.follow = true;
        syncToLeader(); // 다시 켜면 바로 리더 위치로
      }
    },
    [roomId, syncToLeader],
  );

  const publishPosition = useCallback(
    (songId: string, page: number) => {
      const myEpoch = latest.current.me.epoch;
      if (myEpoch === null) return;
      const prev = latest.current.position;
      const same = prev.songId === songId && prev.page === page;
      // 위치가 같아도(새로고침 직후·리더 맡은 직후) Presence에는 내 위치를 실어야 한다
      const order = { epoch: myEpoch, seq: Math.max(Date.now(), knownOrder.current.seq + 1) };
      knownOrder.current = order;
      const leaderPos: LeaderPos = { songId, page, ...order };
      setMyPos(leaderPos);
      if (same) return;
      const event = prev.songId === songId ? "page_change" : "song_change";
      const pos = { songId, page };
      latest.current.position = pos;
      setPositionState(pos);
      void channelRef.current?.send({
        type: "broadcast",
        event,
        payload: { ...leaderPos, from: clientId } satisfies PositionEvent,
      });
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void setPosition(code, songId, page);
      }, PERSIST_DELAY);
    },
    [clientId, code],
  );

  const subscribePosition = useCallback((cb: PositionListener) => {
    listeners.current.add(cb);
    return () => {
      listeners.current.delete(cb);
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
    subscribePosition,
  };

  return <Ctx value={value}>{children}</Ctx>;
}

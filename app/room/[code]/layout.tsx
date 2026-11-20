import { Suspense } from "react";
import { connection } from "next/server";
import { RoomRealtimeProvider } from "@/components/room/RoomRealtime";
import { requireRoom } from "@/lib/rooms";

/**
 * 방 안의 모든 화면(셋리스트·뷰어)이 실시간 채널 하나를 공유하도록 레이아웃에서 연결한다.
 * 화면을 옮겨도 채널·접속 표시·리더 상태가 끊기지 않는다.
 */
export default function RoomLayout({ children, params }: LayoutProps<"/room/[code]">) {
  return (
    <Suspense fallback={null}>
      {params.then(({ code }) => (
        <RealtimeGate code={code}>{children}</RealtimeGate>
      ))}
    </Suspense>
  );
}

async function RealtimeGate({ code, children }: { code: string; children: React.ReactNode }) {
  await connection();
  const auth = await requireRoom(code);
  if (!auth) return children; // 미입장: 각 페이지가 입장 화면을 보여준다

  const { room, session } = auth;
  return (
    <RoomRealtimeProvider
      code={room.code}
      roomId={room.id}
      nickname={session.nickname}
      instrument={session.instrument}
      initialPosition={{ songId: room.current_song_id, page: room.current_page }}
    >
      {children}
    </RoomRealtimeProvider>
  );
}

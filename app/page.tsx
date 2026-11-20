import { Suspense } from "react";
import { connection } from "next/server";
import { CreateRoomForm, JoinRoomForm } from "@/components/room/RoomForms";
import { RoomList as RoomListView } from "@/components/room/RoomList";
import { listRooms } from "@/lib/rooms";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Tutti</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">합주팀을 위한 실시간 공유 악보</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">방 목록</h2>
        <p className="-mt-2 text-sm text-zinc-500">방을 누르고 방 번호(4자리)를 입력하면 들어갈 수 있습니다.</p>
        <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
          <RoomList />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">번호로 입장</h2>
        <p className="-mt-2 text-sm text-zinc-500">목록에 없는 방(최근 100개 밖)도 번호로 들어갈 수 있습니다.</p>
        <JoinRoomForm />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">새 방 만들기</h2>
        <CreateRoomForm />
      </section>
    </main>
  );
}

async function RoomList() {
  // 방 목록은 요청 시점 DB 값 (Cache Components: 요청 시 렌더)
  await connection();
  let rooms;
  try {
    rooms = await listRooms();
  } catch (err) {
    // DB 오류 외에 ROOM_SESSION_SECRET 누락(목록 참조값 생성 실패)도 여기로 온다 → 서버 로그로 원인 구분
    console.error("방 목록 조회 실패:", err instanceof Error ? err.message : err);
    return <p className="text-sm text-red-600 dark:text-red-400">방 목록을 불러오지 못했습니다. 새로고침해 보세요.</p>;
  }
  if (rooms.length === 0) {
    return <p className="text-sm text-zinc-500">아직 방이 없습니다. 아래에서 새 방을 만드세요.</p>;
  }
  return <RoomListView rooms={rooms} />;
}

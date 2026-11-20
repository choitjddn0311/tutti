import { Suspense } from "react";
import { connection } from "next/server";
import { CreateRoomForm, JoinRoomForm } from "@/components/room/RoomForms";
import { RoomList as RoomListView } from "@/components/room/RoomList";
import { listRooms } from "@/lib/rooms";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2">
        <span className="text-lg font-bold">tutti</span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">함께 보는 악보</h1>
        <p className="text-muted">합주팀을 위한 실시간 공유 악보</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-3 sm:p-4">
          <div className="flex items-end justify-between gap-3 px-2 pt-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">방 목록</h2>
              <p className="mt-1 text-sm text-muted">방을 누르고 방 번호(4자리)를 입력하면 들어갈 수 있습니다.</p>
            </div>
          </div>
          <Suspense fallback={<p className="px-2 pb-2 text-sm text-muted">불러오는 중…</p>}>
            <RoomList />
          </Suspense>
        </section>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
            <div>
              <h2 className="text-lg font-bold">번호로 입장</h2>
              <p className="mt-1 text-sm text-muted">목록에 없는 방(최근 100개 밖)도 번호로 들어갈 수 있습니다.</p>
            </div>
            <JoinRoomForm />
          </section>

          <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
            <div>
              <h2 className="text-lg font-bold">새 방 만들기</h2>
              <p className="mt-1 text-sm text-muted">만들면 4자리 방 번호가 생깁니다. 번호가 곧 입장 비밀번호예요.</p>
            </div>
            <CreateRoomForm />
          </section>
        </div>
      </div>
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
    return <p className="px-2 pb-2 text-sm text-danger">방 목록을 불러오지 못했습니다. 새로고침해 보세요.</p>;
  }
  if (rooms.length === 0) {
    return <p className="px-2 pb-2 text-sm text-muted">아직 방이 없습니다. 새 방을 만들어 보세요.</p>;
  }
  return <RoomListView rooms={rooms} />;
}

import { CreateRoomForm, JoinRoomForm } from "@/components/room/RoomForms";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Tutti</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          합주팀을 위한 실시간 공유 악보
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-8 sm:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">방 코드로 입장</h2>
          <JoinRoomForm />
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">새 방 만들기</h2>
          <CreateRoomForm />
        </section>
      </div>
    </main>
  );
}

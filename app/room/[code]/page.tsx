import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { JoinRoomForm } from "@/components/room/RoomForms";
import { RoomNowPlaying, RoomSidebarLive } from "@/components/room/RoomLive";
import { Setlist } from "@/components/setlist/Setlist";
import { ROOM_CODE_RE } from "@/lib/room-auth";
import { listSongs, requireRoom } from "@/lib/rooms";

export default function RoomPage({ params }: PageProps<"/room/[code]">) {
  return (
    <Suspense fallback={<p className="p-6 text-muted">불러오는 중…</p>}>
      {params.then(({ code }) => (
        <RoomContent code={code} />
      ))}
    </Suspense>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex h-9 shrink-0 items-center rounded-full border border-line px-4 text-xs font-medium hover:border-fg"
    >
      방 목록
    </Link>
  );
}

async function RoomContent({ code }: { code: string }) {
  // 쿠키 세션 만료 확인에 현재 시각을 쓰므로 요청 시점 렌더링으로 고정
  await connection();
  if (!ROOM_CODE_RE.test(code)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p>존재하지 않는 방 번호입니다.</p>
        <BackLink />
      </main>
    );
  }

  const auth = await requireRoom(code);
  if (!auth) {
    // 입장 전에는 방 이름·존재 여부를 보여주지 않는다 (방 번호가 입장 비밀번호이므로,
    // /room/0000~9999를 훑어 '목록의 어느 방이 몇 번인지' 알아내지 못하게). 틀린 번호면 입장 시 같은 안내.
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8 px-4 py-8">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">tutti</span>
          <BackLink />
        </div>
        <div className="flex flex-col items-center gap-3 pt-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight">방 입장</h1>
          <span className="text-xs text-muted">방 번호</span>
          <span className="pl-[0.3em] text-5xl font-bold tabular-nums tracking-[0.3em]">{code}</span>
          <p className="text-sm text-muted">링크로 들어왔어요. 닉네임과 악기만 입력하면 입장합니다.</p>
        </div>
        <JoinRoomForm code={code} />
      </main>
    );
  }

  const { room, session } = auth;
  const songs = await listSongs(room.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-start">
      <aside className="flex flex-col gap-6 rounded-3xl bg-surface p-5 lg:sticky lg:top-4 lg:w-[300px] lg:shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">tutti</span>
          <BackLink />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{room.name}</h1>
          <span className="mt-2 text-xs text-muted">방 번호 · 입장 비밀번호</span>
          <span className="text-5xl font-bold tabular-nums tracking-[0.06em]">{room.code}</span>
          <span className="mt-2 text-xs text-muted">
            나: {session.nickname} · {session.instrument}
          </span>
        </div>
        <RoomSidebarLive />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-4 rounded-3xl border border-line bg-surface p-4 sm:p-6">
        <RoomNowPlaying songs={songs.map(({ id, title }) => ({ id, title }))} />
        <Setlist
          code={room.code}
          songs={songs.map(({ id, title, file_type, page_count }) => ({
            id,
            title,
            file_type,
            page_count,
          }))}
        />
      </section>
    </main>
  );
}

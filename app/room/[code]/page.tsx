import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { JoinRoomForm } from "@/components/room/RoomForms";
import { RoomLive } from "@/components/room/RoomLive";
import { Setlist } from "@/components/setlist/Setlist";
import { ROOM_CODE_RE } from "@/lib/room-auth";
import { findRoomByCode, listSongs, requireRoom } from "@/lib/rooms";

export default function RoomPage({ params }: PageProps<"/room/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Tutti
      </Link>
      <Suspense fallback={<p className="text-zinc-500">불러오는 중…</p>}>
        {params.then(({ code }) => (
          <RoomContent code={code} />
        ))}
      </Suspense>
    </main>
  );
}

async function RoomContent({ code }: { code: string }) {
  // 쿠키 세션 만료 확인에 현재 시각을 쓰므로 요청 시점 렌더링으로 고정
  await connection();
  if (!ROOM_CODE_RE.test(code)) {
    return <p>존재하지 않는 방 번호입니다.</p>;
  }

  const auth = await requireRoom(code);
  if (!auth) {
    let target;
    try {
      target = await findRoomByCode(code);
    } catch {
      return <p className="text-red-600 dark:text-red-400">방 정보를 불러오지 못했습니다. 새로고침해 보세요.</p>;
    }
    if (!target) return <p>존재하지 않는 방 번호입니다.</p>;
    return (
      <section className="mx-auto flex w-full max-w-sm flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{target.name}</h1>
          <p className="text-sm text-zinc-500">
            방 번호 <span className="font-mono tracking-widest">{code}</span> · 닉네임과 악기를 입력하고 입장하세요
          </p>
        </div>
        <JoinRoomForm code={code} />
      </section>
    );
  }

  const { room, session } = auth;
  const songs = await listSongs(room.id);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{room.name}</h1>
          <p className="text-sm text-zinc-500">
            방 번호(입장 비밀번호) <span className="font-mono text-base tracking-widest text-zinc-900 dark:text-zinc-100">{room.code}</span>
          </p>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {session.nickname} · {session.instrument}
        </p>
      </header>
      <RoomLive songs={songs.map(({ id, title }) => ({ id, title }))} />
      <Setlist
        code={room.code}
        songs={songs.map(({ id, title, file_type, page_count }) => ({
          id,
          title,
          file_type,
          page_count,
        }))}
      />
    </>
  );
}

import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ScoreViewer } from "@/components/viewer/ScoreViewer";
import { getSongWithUrl, listSectionsForSong, listSongs, requireRoom } from "@/lib/rooms";

export default function SongPage({ params }: PageProps<"/room/[code]/song/[songId]">) {
  return (
    <Suspense fallback={<p className="p-6 text-muted">불러오는 중…</p>}>
      {params.then(({ code, songId }) => (
        <SongContent code={code} songId={songId} />
      ))}
    </Suspense>
  );
}

async function SongContent({ code, songId }: { code: string; songId: string }) {
  // 쿠키 세션 만료 확인·서명 URL 발급은 요청 시점에 해야 한다
  await connection();

  const auth = await requireRoom(code);
  if (!auth) redirect(`/room/${code}`); // 미입장 → 방 입장 화면

  const [song, sections, songs] = await Promise.all([
    getSongWithUrl(auth.room.id, songId),
    // 섹션·셋리스트는 부가 정보 — 실패해도 악보는 보여준다
    listSectionsForSong(auth.room.id, songId).catch(() => []),
    listSongs(auth.room.id).catch(() => []),
  ]);
  if (!song) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p>곡을 찾을 수 없습니다. 삭제되었을 수 있습니다.</p>
        <Link href={`/room/${code}`} className="inline-flex h-11 items-center rounded-full border border-fg px-5 text-sm font-semibold">
          셋리스트로
        </Link>
      </main>
    );
  }

  return (
    <ScoreViewer
      // 곡이 바뀌면 페이지 상태 초기화
      key={song.id}
      songId={song.id}
      title={song.title}
      url={song.url}
      fileType={song.file_type}
      pageCount={song.page_count}
      backHref={`/room/${code}`}
      code={code}
      initialSections={sections}
      songs={songs.map(({ id, title, file_type, page_count }) => ({ id, title, file_type, page_count }))}
    />
  );
}

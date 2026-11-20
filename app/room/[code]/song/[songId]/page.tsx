import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ScoreViewer } from "@/components/viewer/ScoreViewer";
import { getSongWithUrl, requireRoom } from "@/lib/rooms";

export default function SongPage({ params }: PageProps<"/room/[code]/song/[songId]">) {
  return (
    <Suspense fallback={<p className="p-6 text-zinc-500">불러오는 중…</p>}>
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

  const song = await getSongWithUrl(auth.room.id, songId);
  if (!song) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p>곡을 찾을 수 없습니다. 삭제되었을 수 있습니다.</p>
        <Link href={`/room/${code}`} className="text-sm underline">
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
    />
  );
}

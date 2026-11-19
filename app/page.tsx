export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Tutti</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          합주팀을 위한 실시간 공유 악보
        </p>
      </div>

      {/* 방 만들기 / 입장은 로드맵 2단계에서 구현 */}
      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          disabled
          className="h-12 rounded-lg bg-zinc-900 font-medium text-white opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          방 만들기
        </button>
        <button
          type="button"
          disabled
          className="h-12 rounded-lg border border-zinc-300 font-medium opacity-40 dark:border-zinc-700"
        >
          방 코드로 입장
        </button>
        <p className="text-center text-sm text-zinc-500">준비 중</p>
      </div>
    </main>
  );
}

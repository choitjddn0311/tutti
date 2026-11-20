"use client";

import { useRef, useState, useTransition } from "react";
import { deleteSong, finalizeUpload, moveSong, prepareUpload } from "@/app/actions/setlist";
import { countPdfPages } from "@/lib/pdf";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  ACCEPT_ATTR,
  ALLOWED_MIME,
  MAX_TITLE_LENGTH,
  MAX_UPLOAD_BYTES,
  SCORES_BUCKET,
} from "@/lib/upload-rules";

export type SetlistSong = {
  id: string;
  title: string;
  file_type: "pdf" | "image";
  page_count: number;
};


export function Setlist({ code, songs }: { code: string; songs: SetlistSong[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "오류가 발생했습니다.");
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">셋리스트</h2>

      {songs.length === 0 ? (
        <p className="text-sm text-zinc-500">아직 곡이 없습니다. 악보를 올려 추가하세요.</p>
      ) : (
        <ol className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {songs.map((song, i) => (
            <li key={song.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 text-right text-sm text-zinc-500">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{song.title}</p>
                <p className="text-xs text-zinc-500">
                  {song.file_type === "pdf" ? `PDF · ${song.page_count}쪽` : "이미지"}
                </p>
              </div>
              <IconButton
                label="위로"
                disabled={busy || i === 0}
                onClick={() => run(() => moveSong(code, song.id, -1))}
              >
                ↑
              </IconButton>
              <IconButton
                label="아래로"
                disabled={busy || i === songs.length - 1}
                onClick={() => run(() => moveSong(code, song.id, 1))}
              >
                ↓
              </IconButton>
              <IconButton
                label="삭제"
                disabled={busy}
                onClick={() => run(() => deleteSong(code, song.id))}
              >
                ✕
              </IconButton>
            </li>
          ))}
        </ol>
      )}

      <UploadForm code={code} onError={setError} />
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}

function IconButton({
  label,
  children,
  ...props
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="h-9 w-9 shrink-0 rounded-md border border-zinc-300 text-sm disabled:opacity-30 dark:border-zinc-700"
      {...props}
    >
      {children}
    </button>
  );
}

function UploadForm({ code, onError }: { code: string; onError: (e: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return onError("파일을 선택하세요.");
    if (!ALLOWED_MIME[file.type]) {
      return onError("PDF, PNG, JPEG, WebP 파일만 올릴 수 있습니다.");
    }
    if (file.size > MAX_UPLOAD_BYTES) return onError("파일은 20MB 이하여야 합니다.");

    try {
      let pageCount = 1;
      if (file.type === "application/pdf") {
        setStatus("PDF 확인 중…");
        try {
          pageCount = await countPdfPages(file);
        } catch (err) {
          console.error("PDF 페이지 수 계산 실패", err);
          return onError("PDF를 읽을 수 없습니다. 손상되었거나 암호가 걸린 파일인지 확인하세요.");
        }
      }

      setStatus("업로드 준비 중…");
      const prep = await prepareUpload(code, { contentType: file.type, size: file.size });
      if (!prep.ok) return onError(prep.error);

      setStatus("업로드 중…");
      const { error } = await getBrowserSupabase()
        .storage.from(SCORES_BUCKET)
        .uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
      if (error) return onError("업로드에 실패했습니다.");

      setStatus("곡 추가 중…");
      const done = await finalizeUpload(code, {
        path: prep.path,
        title: (title.trim() || file.name.replace(/\.[^.]+$/, "")).slice(0, MAX_TITLE_LENGTH),
        pageCount,
      });
      if (!done.ok) return onError(done.error);

      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      onError("업로드 중 오류가 발생했습니다.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <form onSubmit={upload} className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="곡 제목 (비우면 파일 이름)"
        maxLength={MAX_TITLE_LENGTH}
        className="h-10 rounded-md border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
      />
      <input ref={fileRef} type="file" accept={ACCEPT_ATTR} required className="text-sm" />
      <p className="text-xs text-zinc-500">PDF·PNG·JPEG·WebP, 20MB 이하</p>
      <button
        type="submit"
        disabled={status !== null}
        className="h-10 rounded-md bg-zinc-900 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {status ?? "악보 올리기"}
      </button>
    </form>
  );
}

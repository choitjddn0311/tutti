"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { deleteSong, finalizeUpload, moveSong, prepareUpload } from "@/app/actions/setlist";
import { useRoomRealtime } from "@/components/room/RoomRealtime";
import { countPdfPages } from "@/lib/pdf";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { btnIcon, btnPrimary, field } from "@/components/ui";
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
  const rt = useRoomRealtime();
  const forgetSong = rt?.forgetSong;
  // 리더가 지금 합주 중인 곡 (리더가 없으면 표시하지 않음)
  const playingId = rt?.leader ? rt.position.songId : null;
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
      {songs.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
          아직 곡이 없습니다. 악보를 올려 추가하세요.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {songs.map((song, i) => {
            const playing = song.id === playingId;
            return (
            <li
              key={song.id}
              className={`flex min-h-16 items-center gap-3 rounded-full py-2 pl-5 pr-2.5 ${
                playing ? "bg-canvas ring-1 ring-fg" : "ring-1 ring-line"
              }`}
            >
              <span className="w-6 shrink-0 text-[15px] font-bold tabular-nums text-muted">{i + 1}</span>
              <Link href={`/room/${code}/song/${song.id}`} className="min-w-0 flex-1 py-1">
                <p className="truncate text-[17px] font-semibold">{song.title}</p>
                <p className="text-xs text-muted">
                  {song.file_type === "pdf" ? `PDF · ${song.page_count}쪽` : "이미지"}
                  {playing && " · 지금 합주 중"}
                </p>
              </Link>
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
                onClick={() =>
                  run(async () => {
                    const r = await deleteSong(code, song.id);
                    if (r.ok) forgetSong?.(song.id);
                    return r;
                  })
                }
              >
                ✕
              </IconButton>
            </li>
            );
          })}
        </ol>
      )}

      <UploadForm code={code} onError={setError} />
      {error && (
        <p role="alert" className="px-2 text-sm text-danger">
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
      className={`${btnIcon} text-sm`}
      {...props}
    >
      {children}
    </button>
  );
}

const MAX_BATCH = 20; // 한 번에 올릴 수 있는 파일 수

/** 파일 이름 순(숫자는 크기 순: 2곡 < 10곡)으로 정렬 → 셋리스트 순서가 예측 가능 */
function byName(a: File, b: File) {
  return a.name.localeCompare(b.name, "ko", { numeric: true });
}

/** 글자 단위로 자른다 (UTF-16 단위로 자르면 이모지가 반으로 깨져 저장 실패) */
const cut = (s: string, n: number) => Array.from(s).slice(0, n).join("");
/** 파일 이름에서 확장자를 뺀 제목. 이름이 비면(예: '.pdf') '제목 없음' */
const titleFromName = (name: string) => cut(name.replace(/\.[^.]+$/, "").trim(), MAX_TITLE_LENGTH) || "제목 없음";

type UploadResult = { error: string; fatal?: boolean } | null;

/** 파일 하나 올리기: 확인 → 서명 URL → Storage 직접 업로드 → 곡 추가. 실패하면 이유를 돌려준다 */
async function uploadOne(code: string, file: File, title: string, onStep: (s: string) => void): Promise<UploadResult> {
  if (!ALLOWED_MIME[file.type]) return { error: "PDF, PNG, JPEG, WebP 파일만 올릴 수 있습니다." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "20MB를 넘습니다." };

  let pageCount = 1;
  if (file.type === "application/pdf") {
    onStep("PDF 확인 중");
    try {
      pageCount = await countPdfPages(file);
    } catch (err) {
      console.error("PDF 페이지 수 계산 실패", err);
      return { error: "PDF를 읽을 수 없습니다 (손상·암호 확인)." };
    }
  }

  onStep("업로드 준비 중");
  const prep = await prepareUpload(code, { contentType: file.type, size: file.size });
  if (!prep.ok) return { error: prep.error, fatal: prep.fatal };

  onStep("업로드 중");
  const { error } = await getBrowserSupabase()
    .storage.from(SCORES_BUCKET)
    .uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
  if (error) return { error: "업로드에 실패했습니다." };

  onStep("곡 추가 중");
  const done = await finalizeUpload(code, { path: prep.path, title, pageCount });
  return done.ok ? null : { error: done.error, fatal: done.fatal };
}

/** 실패 목록을 이유별로 묶어 짧게: "이유 (a.pdf, b.pdf 외 3개)" */
function summarize(failed: { name: string; error: string }[]) {
  const byReason = new Map<string, string[]>();
  for (const f of failed) byReason.set(f.error, [...(byReason.get(f.error) ?? []), f.name]);
  return [...byReason]
    .map(([reason, names]) => `${reason} (${names.slice(0, 2).join(", ")}${names.length > 2 ? ` 외 ${names.length - 2}개` : ""})`)
    .join(" / ");
}

function UploadForm({ code, onError }: { code: string; onError: (e: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  // 업로드 도중 화면을 떠나면 남은 파일은 올리지 않는다
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    const files = Array.from(fileRef.current?.files ?? []).sort(byName);
    if (files.length === 0) return onError("파일을 선택하세요.");
    if (files.length > MAX_BATCH) return onError(`한 번에 ${MAX_BATCH}개까지 올릴 수 있습니다.`);

    const failed: { name: string; error: string }[] = [];
    let stopped: string | null = null;
    try {
      // 순서대로 하나씩 올린다 (셋리스트 순서 = 파일 이름 순, 실패해도 나머지는 계속)
      for (const [i, file] of files.entries()) {
        if (!mounted.current) return;
        const prefix = files.length > 1 ? `${i + 1}/${files.length} ` : "";
        // 제목 칸은 파일이 하나일 때만 쓴다 (여러 개면 각자 파일 이름)
        const typed = cut(title.trim(), MAX_TITLE_LENGTH);
        const t = files.length === 1 && typed ? typed : titleFromName(file.name);
        try {
          const r = await uploadOne(code, file, t, (step) => setStatus(`${prefix}${step}…`));
          if (r?.fatal) {
            // 입장이 풀리는 등 다음 파일도 실패할 오류 → 멈추고 한 번만 안내
            stopped = r.error;
            break;
          }
          if (r) failed.push({ name: file.name, error: r.error });
        } catch {
          failed.push({ name: file.name, error: "업로드 중 오류가 발생했습니다." });
        }
      }
    } finally {
      if (mounted.current) setStatus(null);
    }
    if (!mounted.current) return;

    // 성공한 파일은 이미 셋리스트에 들어갔으므로 선택을 항상 비운다 (다시 누르면 중복 추가되는 것 방지)
    setTitle("");
    setCount(0);
    if (fileRef.current) fileRef.current.value = "";
    if (stopped) {
      onError(stopped);
    } else if (failed.length > 0) {
      const ok = files.length - failed.length;
      onError((files.length > 1 ? `${files.length}개 중 ${ok}개 올림, ${failed.length}개 실패 — ` : "") + summarize(failed));
    }
  }

  const multiple = count > 1;
  return (
    <form onSubmit={upload} className="flex flex-col gap-3 rounded-[20px] bg-canvas p-4 sm:p-5">
      <div>
        <h3 className="text-base font-bold">악보 올리기</h3>
        <p className="mt-1 text-xs text-muted">
          PDF·PNG·JPEG·WebP, 파일당 20MB 이하 · 여러 개 선택 가능(최대 {MAX_BATCH}개, 파일 이름 순으로 추가)
        </p>
      </div>
      <input
        value={multiple ? "" : title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={multiple ? `파일 ${count}개 — 각 파일 이름이 곡 제목이 됩니다` : "곡 제목 (비우면 파일 이름)"}
        disabled={multiple || status !== null}
        maxLength={MAX_TITLE_LENGTH}
        className={`${field} disabled:opacity-60`}
      />
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        required
        disabled={status !== null}
        onChange={(e) => setCount(e.currentTarget.files?.length ?? 0)}
        className="text-sm text-muted file:mr-3 file:h-10 file:rounded-full file:border file:border-fg file:bg-transparent file:px-4 file:text-sm file:font-semibold file:text-fg"
      />
      <button
        type="submit"
        disabled={status !== null}
        className={btnPrimary}
      >
        {status ?? (multiple ? `악보 ${count}개 올리기` : "악보 올리기")}
      </button>
    </form>
  );
}

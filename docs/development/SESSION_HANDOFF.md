# SESSION HANDOFF

**마지막 업데이트**: 2026-11-19

## 현재 상태
- 로드맵 **1단계(기반 구축) 완료** — 프로덕션: https://tutti-beige.vercel.app
- git 저장소 초기화됨, **커밋 없음** (모든 파일 untracked)

## 완료한 작업 (1단계)
- Next.js 16.4 + React 19 + TS + Tailwind 4 스캐폴드 (App Router, `src/` 없음, npm)
- `@supabase/supabase-js`, `server-only`, `supabase` CLI(devDependency) 설치
- Supabase 로컬 초기화(`supabase/config.toml`) + 초기 마이그레이션(`rooms`/`songs`/`sections`, RLS, `scores` 버킷)
- `lib/supabase/server.ts`(서버 전용), `lib/supabase/browser.ts`(Realtime 전용, 아직 미사용)
- `app/api/health/route.ts` DB 연결 확인, `app/page.tsx` 기본 랜딩(방 만들기/입장 버튼은 비활성 자리표시)
- `.env.example`, `.env.local`(로컬 키, git 제외), `.gitignore`에 `!.env.example`·supabase 임시폴더 추가
- 리더 규칙 확정 → `PROJECT.md` 반영

## 테스트 결과 (로컬, 2026-11-19)
| 항목 | 결과 |
|---|---|
| `npm run lint` / `tsc --noEmit` / `npm run build` | 통과 |
| `npx supabase start` 마이그레이션 적용 | 성공 |
| `next start` 후 `GET /api/health` | `{"db":"ok"}` 200 |
| `GET /` | Tutti 랜딩 렌더 확인(HTML) |
| publishable 키로 `rooms` 직접 조회 (행 존재 시) | `[]` — RLS 차단 확인 |
| publishable 키로 `rooms` 직접 insert | 401 RLS 위반 — 차단 확인 |
| `scores` 버킷 | 비공개, MIME 4종 제한 확인 |

브라우저 실기기 렌더는 미확인(HTML 응답만 확인).

## 클라우드·배포 (2026-11-19)
- Supabase 클라우드 프로젝트 `tutti` (ref `cxrqsrtkfamidvsylear`, ap-northeast-1)에 link + `db push --remote`로 초기 마이그레이션 적용
- Vercel 프로젝트 `tutti` 연결(`.vercel/`, git 제외), 환경변수 3개를 Production·Preview에 등록 (secret 키는 Sensitive)
- 프로덕션 배포: https://tutti-beige.vercel.app
- 주의: `supabase projects api-keys`는 secret 키를 가려서 출력함 → 실제 값은 `--reveal` 필요 (첫 배포 때 가려진 값이 등록돼 health 503이었고, 수정 후 재배포함)
- `vercel link`가 `.env.local`에 `VERCEL_OIDC_TOKEN`을 추가함 (로컬 Supabase 값은 그대로)

| 배포 검증 | 결과 |
|---|---|
| `GET https://tutti-beige.vercel.app/` | 200, Tutti 랜딩 |
| `GET /api/health` | `{"db":"ok"}` 200 |
| 클라우드 DB에 publishable 키로 `rooms` insert | 401 RLS 차단 |

## 개발 로드맵
| 단계 | 목표 | 완료 조건(DoD) | 상태 |
|---|---|---|---|
| 1. 기반 구축 | 스캐폴드, Supabase 연결, 스키마, Vercel 배포 | 배포 URL에서 기본 페이지 + DB 연결 확인 | **완료** |
| 2. 방 & 셋리스트 | 방 생성/코드 입장, 닉네임·악기, 곡 업로드·정렬·삭제 | 두 브라우저에서 같은 방·셋리스트 확인 | 미착수 |
| 3. 악보 뷰어 | PDF/이미지 렌더, 페이지 넘김, 키보드·페달, Wake Lock, 반응형 | 태블릿·폰에서 다중 페이지 PDF 정상 열람 | 미착수 |
| 4. 실시간 동기화 | Presence, 리더 넘김 동기화, 따라가기 토글, 재접속 복구 | 3개 클라이언트에서 지연 체감 없음, 새로고침 후 현재 위치 복귀 | 미착수 |
| 5. 사인 & 섹션 | 섹션 라벨 편집, 위치 사인 오버레이, 프리셋 큐, 텍스트 메시지 | 화면 크기가 다른 기기에서도 사인이 같은 위치에 표시 | 미착수 |

5단계 완료 = MVP 완료.

## 미해결 사항
- `PROJECT.md` §5 미정: 업로드 용량 한도, 프리셋 큐 목록, 테스트 도구
- `AGENTS.md`는 `next dev`가 자동 생성·재추가하는 파일 (Next.js 16 문서 안내). 유지.

- 마이그레이션 변경 시 로컬 `npx supabase db reset` 검증 후 `npx supabase db push --remote`로 클라우드 반영
- 배포는 현재 CLI 수동 배포(`npx vercel deploy --prod`). GitHub 연동 자동 배포는 미설정

## 다음 작업
**로드맵 2단계: 방 & 셋리스트**
- 방 생성(랜덤 코드)/코드 입장, 닉네임·악기 입력
- 곡 업로드(PDF/이미지 → `scores` 버킷)·정렬·삭제 (서버 경유, 방 코드 검증)
- DoD: 두 브라우저에서 같은 방·셋리스트 확인

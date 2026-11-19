# Tutti

합주팀이 같은 공간에서 각자 기기로 같은 악보(PDF/이미지)를 보고, 리더의 페이지 넘김을 동기화하며, "어디로 돌아갈지" 사인을 주고받는 웹앱.

## Project Documentation
- 프로젝트 개요·기술 스택·아키텍처·데이터 모델: `docs/development/PROJECT.md`
- 현재 진행 상황·다음 작업: `docs/development/SESSION_HANDOFF.md`
- 컨텍스트 관리 절차: `docs/development/CONTEXT_GUIDE.md`

## Development Rules
- `PROJECT.md`에 확정된 기술 스택과 아키텍처를 따른다. 설계 변경이 필요하면 이유를 설명하고 먼저 확인받는다.
- `미정`으로 표시된 항목은 임의로 확정하지 말고 사용자에게 묻는다.
- 현재 로드맵 단계에 필요한 작업만 진행한다. MVP 범위 밖 기능을 미리 만들지 않는다.
- 구현한 기능은 실제로 실행해 테스트한다. 확인하지 않은 기능을 완료로 보고·기록하지 않는다.
- 악보 위 위치(사인·섹션)는 항상 페이지 기준 0~1 정규화 좌표로 다룬다.
- DB·Storage 접근은 서버(`lib/supabase/server.ts`)에서만 한다. 브라우저 클라이언트는 Realtime 전용.
- Next.js 16 사용: 코드 작성 전 `AGENTS.md` 안내대로 `node_modules/next/dist/docs/`를 확인한다.

## Git Workflow
- `main`에 직접 커밋·푸시하지 않는다. 기능마다 브랜치(`feat/<기능>`, `fix/<내용>`)를 만들어 작업한다.
- 기능 개발이 끝나면 브랜치에 커밋·푸시하고 PR을 올린다(`gh pr create`).
- PR은 코드 리뷰(`/code-review`)로 검증하고, 지적 사항을 반영한다.
- 리뷰에 문제가 없고 사용자가 승인하면 그때 `main`에 병합한다. 병합은 임의로 하지 않는다.

## Commands
- 로컬 DB: `npx supabase start` (Docker 필요) / 스키마 재적용: `npx supabase db reset`
- 개발 서버: `npm run dev` / 검증: `npm run lint`, `npm run build`
- DB 연결 확인: `GET /api/health` → `{"db":"ok"}`

## Context Management
- 작업 시작 시 `SESSION_HANDOFF.md`로 현재 상태를 확인한다.
- 필요한 파일과 코드 구간만 읽고 반복적인 전체 분석을 피한다.
- 기능 단위 작업 완료, 작업 전환, 세션 종료 전에 `SESSION_HANDOFF.md`를 갱신한다.
- 문서에 기록되지 않은 사실을 추측하지 않는다.

# PROJECT — Tutti

> 오래 유지되는 프로젝트 정보. 진행 상황은 `SESSION_HANDOFF.md` 참고.
> 상태 표기: **확정** / **초안**(구현 중 조정 가능, 변경 시 기록) / **미정**(사용자 확인 필요)

## 1. 목적
같은 공간에서 합주하는 지인 팀이 각자 태블릿/폰으로:
- **같은 악보를 보고**
- **리더의 페이지 넘김을 실시간으로 따라가며**
- **"어디로 돌아갈지" 등 사인을 주고받는다.**

성격: 개인용(지인 합주팀). 상용 서비스 아님. 오디오 기능 없음.

## 2. 확정 요구사항
| 항목 | 결정 |
|---|---|
| 악보 형식 | PDF / 이미지 업로드 (MusicXML 미지원) |
| 넘김 방식 | 리더가 넘기면 전원 따라감. 각자 '따라가기'를 끄고 독립 열람 가능 |
| 사인 | ① 위치 지정 사인 ② 프리셋 큐 버튼 ③ 섹션 라벨 ④ 짧은 텍스트 메시지 |
| 입장 | 로그인 없음. 방 코드/링크 + 닉네임·악기 입력 |
| 사용 환경 | 같은 공간 합주 → 저지연 실시간 동기화 중요 |
| 악보 구성 | 방 = 셋리스트(여러 곡). 곡마다 전원 공통 악보 1개 |
| 데이터 보존 | 방 단위 영구 보관 (재입장 시 셋리스트·섹션 유지) |

### 사용자 흐름
방 만들기 → 코드/링크 공유 → 참가자 입장(닉네임·악기) → 셋리스트에 곡 추가(파일 업로드) → (선택) 섹션 라벨 지정 → 합주: 리더 넘김 → 전원 동기화 / 누구든 사인 발신 → 전원 화면에 오버레이·하이라이트

### MVP 범위
- 방 생성/입장, 접속자 표시(닉네임·악기·리더)
- 셋리스트 관리 + PDF/이미지 업로드
- 악보 뷰어(페이지 넘김, 키보드·블루투스 페달 입력, 화면 꺼짐 방지 Wake Lock, 반응형)
- 리더 동기화 넘김 + 따라가기 토글, 재접속 시 현재 위치 복구
- 사인 4종(위치 사인, 프리셋 큐, 섹션 라벨, 텍스트 메시지)

### 추후 확장 (MVP 이후, 미착수)
악보 필기/주석, 2페이지 펼침 보기, 파트별 악보, 계정·개인 라이브러리, 메트로놈/카운트인, 오프라인(PWA) 모드, 방 비밀번호

### 예외 상황 대응
| 상황 | 대응 |
|---|---|
| 리더 이탈/끊김 | 다른 참가자가 리더를 이어받을 수 있음 |
| 재접속·늦은 입장 | DB에 저장된 현재 곡/페이지로 즉시 맞춤 |
| 기기 화면 크기 차이 | 위치는 페이지 기준 0~1 정규화 좌표로 저장·전송 |
| 대용량 PDF 로딩 | 다음 페이지 미리 렌더, 브라우저 캐시 |
| 합주 중 화면 꺼짐 | Screen Wake Lock API |
| 잘못된 방 코드 / 업로드 실패·미지원 형식 | 오류 안내 |

## 3. 기술 스택 (확정)
| 영역 | 선택 | 이유 |
|---|---|---|
| 프론트엔드 | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 | 단일 코드베이스, Vercel 배포 간편 |
| PDF 렌더링 | pdf.js (`react-pdf`) | 페이지 단위 캔버스 렌더, 오버레이 얹기 쉬움 |
| DB / 파일 / 실시간 | Supabase (Postgres + Storage + Realtime Broadcast·Presence) | 별도 WebSocket 서버 불필요, 무료 티어로 충분 |
| 배포 | Vercel + Supabase 클라우드 | 운영 부담 최소 |
| 인증 | 없음. 추측 어려운 랜덤 방 코드가 접근 키 | 개인용 요구에 맞춤 |

검토한 대안: Node + Socket.IO 자체 서버(제어권↑, 상시 서버 운영 부담↑, Vercel 부적합), Firebase(유사하나 셋리스트·섹션은 관계형 모델이 자연스러움) → Supabase 채택.

## 4. 아키텍처
- **실시간 (초안)**: 방마다 Supabase Realtime 채널 1개
  - Presence: 접속자(닉네임, 악기, 리더 여부)
  - Broadcast 이벤트: `page_change`, `song_change`, `signal`, `message`
  - 현재 곡/페이지는 `rooms` 행에도 저장 → 늦게 들어온 참가자 동기화
- **휘발성 데이터**: 사인·텍스트 메시지는 DB에 저장하지 않음
- **리더 (확정)**: 방 안의 누구나 '리더 맡기' 가능 (지인 팀 신뢰 기반)
- **데이터 접근 (확정)**: 모든 테이블 RLS ON + 정책 없음 → 브라우저(publishable 키)의 테이블·Storage 직접 접근 차단. DB·Storage는 Next.js 서버(Route Handler / Server Action)가 방 코드를 검증한 뒤 secret 키 클라이언트로만 접근. 악보 파일은 서명 URL로 제공. 브라우저 클라이언트는 Realtime 전용, 채널명은 방 코드 기반.
- **업로드 형식 (확정)**: Storage 비공개 버킷 `scores`, 허용 MIME = PDF, PNG, JPEG, WebP. 용량 한도는 미정(현재 Supabase 기본값 적용).

### 환경변수 (`.env.example`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(브라우저, Realtime), `SUPABASE_SECRET_KEY`(서버 전용)

### 데이터 모델 (확정 — `supabase/migrations/20261119000000_init.sql`)
```
rooms    (id, code unique, name, current_song_id → songs set null, current_page ≥1, created_at)
songs    (id, room_id → rooms cascade, title, position, file_path, file_type 'pdf'|'image', page_count ≥1, created_at)
sections (id, song_id → songs cascade, label, page ≥1, x, y, created_at)   -- x, y: 0~1 정규화 좌표 (check 제약)
```
셋리스트 순서 컬럼은 SQL 예약어 `order` 대신 `position` 사용.

### 디렉터리 구조
```
app/                  # 라우트: / (방 생성·입장), /room/[code] (합주 화면, 2단계~)
  api/health/         # DB 연결 확인 (구현됨)
components/           # (2단계~) viewer/, setlist/, signals/, presence/
lib/supabase/         # server.ts(서버 전용), browser.ts(Realtime 전용) (구현됨)
supabase/
  config.toml         # 로컬 Supabase 설정
  migrations/         # 스키마
```

## 5. 미정 사항
- **업로드 용량 한도**
- **프리셋 큐 목록** — 기본값 제안: 처음으로 · D.S. · 코다로 · 한 번 더 · 엔딩 · 스톱
- **테스트 도구** (단위 테스트 프레임워크)

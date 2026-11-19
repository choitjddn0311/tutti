-- Tutti 초기 스키마
-- 데이터 접근 원칙: 모든 테이블 RLS ON + 정책 없음 → anon/authenticated 직접 접근 차단.
-- DB·Storage 접근은 Next.js 서버가 방 코드를 검증한 뒤 service role로만 수행한다.

create table public.rooms (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  current_song_id uuid,
  current_page    integer not null default 1 check (current_page >= 1),
  created_at      timestamptz not null default now()
);

create table public.songs (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  title      text not null,
  position   integer not null,           -- 셋리스트 순서 (order는 SQL 예약어)
  file_path  text not null,              -- Storage 'scores' 버킷 내 경로
  file_type  text not null check (file_type in ('pdf', 'image')),
  page_count integer not null default 1 check (page_count >= 1),
  created_at timestamptz not null default now()
);

create index songs_room_id_position_idx on public.songs (room_id, position);

alter table public.rooms
  add constraint rooms_current_song_id_fkey
  foreign key (current_song_id) references public.songs (id) on delete set null;

create table public.sections (
  id         uuid primary key default gen_random_uuid(),
  song_id    uuid not null references public.songs (id) on delete cascade,
  label      text not null,
  page       integer not null check (page >= 1),
  x          real not null check (x >= 0 and x <= 1),  -- 페이지 기준 정규화 좌표
  y          real not null check (y >= 0 and y <= 1),
  created_at timestamptz not null default now()
);

create index sections_song_id_idx on public.sections (song_id);

alter table public.rooms    enable row level security;
alter table public.songs    enable row level security;
alter table public.sections enable row level security;

-- 악보 파일 버킷 (비공개, 서명 URL로 제공). 용량 한도는 미정 → 버킷 한도 미설정.
insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'scores',
  'scores',
  false,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
);

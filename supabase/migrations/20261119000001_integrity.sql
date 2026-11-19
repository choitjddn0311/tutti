-- 무결성 보강 (PR #1 코드 리뷰 반영)

-- 1) rooms.current_song_id는 같은 방의 곡만 가리키도록 복합 FK로 교체
alter table public.songs
  add constraint songs_id_room_id_key unique (id, room_id);

alter table public.rooms
  drop constraint rooms_current_song_id_fkey;

alter table public.rooms
  add constraint rooms_current_song_id_fkey
  foreign key (current_song_id, id) references public.songs (id, room_id)
  on delete set null (current_song_id);

-- songs 삭제 시 rooms 참조 탐색용 인덱스
create index rooms_current_song_id_idx on public.rooms (current_song_id);

-- 2) 셋리스트 순서 중복 방지. 순서 변경 시 한 트랜잭션에서 맞바꿀 수 있도록 DEFERRABLE
drop index public.songs_room_id_position_idx;

alter table public.songs
  add constraint songs_room_id_position_key unique (room_id, position)
  deferrable initially immediate;

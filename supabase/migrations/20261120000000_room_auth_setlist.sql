-- 로드맵 2단계: 방 코드 형식, 방 비밀번호, 업로드 한도, 셋리스트 순서 변경

-- 1) 방 코드: 숫자 4자리
alter table public.rooms
  add constraint rooms_code_format check (code ~ '^[0-9]{4}$');

-- 2) 방 비밀번호 (scrypt 해시만 저장)
alter table public.rooms
  add column password_hash text not null;

-- 3) 업로드 한도: 파일당 20MB
update storage.buckets
set file_size_limit = 20 * 1024 * 1024
where id = 'scores';

-- 4) 셋리스트에서 곡을 위/아래 이웃과 맞바꾼다.
--    (room_id, position) 유니크가 DEFERRABLE 이므로 한 트랜잭션 안에서 교환 가능.
--    서버(secret 키)만 호출하도록 PUBLIC/anon/authenticated 실행 권한을 회수한다.
create function public.move_song(p_room_id uuid, p_song_id uuid, p_direction integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_pos integer;
  v_other_id uuid;
  v_other_pos integer;
begin
  if p_direction not in (-1, 1) then
    raise exception 'invalid direction';
  end if;

  select position into v_pos
  from public.songs
  where id = p_song_id and room_id = p_room_id
  for update;

  if not found then
    return false;
  end if;

  if p_direction < 0 then
    select id, position into v_other_id, v_other_pos
    from public.songs
    where room_id = p_room_id and position < v_pos
    order by position desc
    limit 1
    for update;
  else
    select id, position into v_other_id, v_other_pos
    from public.songs
    where room_id = p_room_id and position > v_pos
    order by position asc
    limit 1
    for update;
  end if;

  if v_other_id is null then
    return false; -- 이미 맨 위/맨 아래
  end if;

  set constraints public.songs_room_id_position_key deferred;
  update public.songs set position = v_other_pos where id = p_song_id;
  update public.songs set position = v_pos where id = v_other_id;
  return true;
end;
$$;

revoke execute on function public.move_song(uuid, uuid, integer) from public, anon, authenticated;

-- 방 비밀번호 제거 (2026-11-21 사용자 결정)
-- 첫 화면에 방 목록을 띄우고 번호만으로 입장한다. 사이트 주소를 아는 누구나 입장 가능 (지인 팀 신뢰 기반).
alter table public.rooms drop column password_hash;

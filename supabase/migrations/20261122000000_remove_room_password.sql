-- 방 비밀번호 제거 (2026-11-21 사용자 결정)
-- 첫 화면 방 목록에서 번호로 입장한다. 사이트 주소를 아는 누구나 입장 가능 (지인 팀 신뢰 기반).
--
-- 배포 순서 안전: 이 단계에서는 NOT NULL만 풀고 컬럼은 남긴다.
--  - 새 코드(password_hash를 넣지 않음)와 옛 코드(password_hash를 읽고 씀)가 모두 이 스키마에서 동작
--  - 컬럼 삭제는 새 코드 배포가 끝난 뒤 별도 마이그레이션으로
alter table public.rooms alter column password_hash drop not null;

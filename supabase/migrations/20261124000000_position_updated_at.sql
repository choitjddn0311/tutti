-- 현재 곡/쪽을 저장한 시각. 오래된(지난 합주) 위치에서 시작하지 않기 위해 (null = 모름 → 오래된 것으로 취급)
alter table public.rooms add column position_updated_at timestamptz;

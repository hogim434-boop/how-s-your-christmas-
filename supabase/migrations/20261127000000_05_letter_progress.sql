-- ============================================================================
-- 05. 편지와 진행률 — 로드맵 Task 009-1
-- ============================================================================
--
-- 이 파일이 하는 일 두 가지
--  1) 화면이 "편지 잠금이 풀리는 시각"을 물어볼 수 있는 함수 (public.letter_unlock_time)
--     💡 왜 필요한가요? 잠금 시각을 정하는 진짜 함수(private.unlock_time)는 화면에서 부를 수 없는 곳에 있습니다.
--        화면이 자기 시계로 12.25를 계산하면, 개발용으로 날짜를 앞당겼을 때 데이터베이스와 어긋납니다.
--        그래서 "데이터베이스가 아는 시각"을 그대로 알려 주는 창구를 하나 엽니다. (읽기만 가능)
--  2) 편지가 생기거나 지워질 때, 그 마을의 "지금까지 가장 높았던 장식 단계"와
--     "처음 10단계(대왕별)에 닿은 시각"을 데이터베이스가 스스로 적어 두기
--     💡 화면의 장식은 언제나 "지금 진행률"로 그립니다(내려가면 장식도 빠짐).
--        여기서 적는 값은 "새 장식 알림을 같은 단계로 두 번 보내지 않기" 위한 기록일 뿐이라 내려가지 않습니다.
--     💡 화면 코드가 아니라 트리거가 적으므로, 누군가 값을 꾸며 넣을 수 없습니다.

-- ---------------------------------------------------------------------------
-- 1. 잠금 시각 알려 주기
-- ---------------------------------------------------------------------------
create function public.letter_unlock_time()
returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select private.unlock_time();
$$;

revoke execute on function public.letter_unlock_time() from public, anon;
grant execute on function public.letter_unlock_time() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 장식 단계 계산 (0~10)
-- ---------------------------------------------------------------------------
-- ⚠️ 화면 쪽 짝: lib/decor/progress.ts의 requiredCount + computeDecorLevel. 규칙을 바꿀 때 함께 고칩니다.
--  - 친구 마을: 써야 할 편지 = 주민 수 × (주민 수 - 1). 혼자면 0단계
--  - 커플 마을: 써야 할 개수 = 10 (질문지 8 + 편지 2). 둘이 다 있을 때만 계산
--  - 단계 = 내림(한 일 × 10 ÷ 써야 할 개수), 최대 10. 정수 나눗셈이라 소수 오차가 없습니다
create function private.decor_level(p_kind text, p_residents int, p_done int)
returns int
language sql immutable set search_path = ''
as $$
  select case
    when p_kind = 'couple' then
      case when p_residents = 2 then least(10, greatest(p_done, 0) * 10 / 10) else 0 end
    when p_residents < 2 then 0
    else least(10, greatest(p_done, 0) * 10 / (p_residents * (p_residents - 1)))
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 최고 장식 단계와 대왕별 시각 기록
-- ---------------------------------------------------------------------------
/** 마을 하나의 지금 장식 단계를 구해서, 기록(최고 단계·대왕별 시각)을 넘었으면 올려 적습니다 */
create function private.refresh_village_peak(p_village uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text;
  v_residents int;
  v_done int;
  v_level int;
begin
  -- for update: 두 사람이 동시에 편지를 보내도 한 명씩 차례로 세도록 마을 줄을 잠깐 잠급니다
  select v.kind into v_kind from public.villages v where v.id = p_village for update;
  if v_kind is null then
    return;
  end if;

  -- 세는 기준은 04 파일의 village_progress와 같습니다 (삭제되지 않은 편지 + 커플 마을이면 질문지 답)
  select count(*)::int into v_residents from public.residents r where r.village_id = p_village;
  select count(*)::int into v_done from public.letters l where l.village_id = p_village and l.deleted_at is null;
  if v_kind = 'couple' then
    v_done := v_done + (select count(*)::int from public.couple_answers a where a.village_id = p_village);
  end if;

  v_level := private.decor_level(v_kind, v_residents, v_done);

  update public.villages v
     set max_decor_level = greatest(v.max_decor_level, v_level),
         -- 처음 10단계에 닿은 시각만 적습니다 (내려갔다가 다시 올라와도 처음 시각 그대로)
         star_attached_at = coalesce(v.star_attached_at, case when v_level >= 10 then now() end)
   where v.id = p_village
     and (v.max_decor_level < v_level or (v_level >= 10 and v.star_attached_at is null));
end;
$$;

/** 편지가 새로 생기거나, 지워졌다(숨김)가 바뀌면 그 마을의 기록을 다시 확인합니다 */
create function private.letters_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.refresh_village_peak(new.village_id);
  return null;
end;
$$;

create trigger letters_after_insert
  after insert on public.letters
  for each row execute function private.letters_after_change();

-- 내용만 고친 경우에는 편지 수가 그대로라 실행하지 않습니다 (삭제 표시가 바뀔 때만)
create trigger letters_after_delete_mark
  after update of deleted_at on public.letters
  for each row
  when (old.deleted_at is distinct from new.deleted_at)
  execute function private.letters_after_change();

-- (커플 마을의 질문지 답(couple_answers)에도 같은 기록이 필요합니다 → 질문지 화면을 만드는 Task 018에서 트리거를 붙입니다)

-- 이 도우미들은 트리거만 부릅니다. 로그인한 사람이 직접 부를 일은 없으므로 실행 권한을 거둡니다
revoke execute on function
  private.decor_level(text, int, int),
  private.refresh_village_peak(uuid),
  private.letters_after_change()
from public, anon, authenticated;

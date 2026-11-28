-- ============================================================================
-- 09. 마을 정원(목표 인원) — 진행률을 "정원" 기준으로 계산 [확정 11.28]
-- ============================================================================
--
-- 왜 필요한가요?
--   예전 규칙은 "써야 할 편지 = 지금 주민 수 × (주민 수 - 1)" 이었습니다.
--   그래서 2명일 때 편지 한 통이 50%가 되고, 친구가 다 모이기 전에 장식을 끝까지 봐 버렸습니다.
--
-- 새 규칙
--   - 친구 마을을 만들 때 정원(3~30명)을 정합니다.
--   - 써야 할 편지 = N × (N - 1), N = "정원"과 "실제 주민 수" 중 큰 쪽
--   - 정원이 찬 뒤 친구가 더 들어오면 정원이 그 인원으로 자동으로 늘어납니다. 최대 30명
--   - 정원은 줄일 수 없습니다
--   - 커플 마을은 지금처럼 2명 고정(항목 10개)
--
-- ⚠️ 화면 쪽 짝: lib/decor/progress.ts(requiredCount), lib/villages/rules.ts(정원 범위). 규칙을 바꿀 때 함께 고칩니다.
--
-- 오류 코드: invalid_capacity(정원이 범위 밖) / village_full(이미 30명) / capacity_cannot_shrink(정원 줄이기)

-- ---------------------------------------------------------------------------
-- 1. 정원 칸 추가
-- ---------------------------------------------------------------------------
alter table public.villages add column capacity smallint;

-- 이미 있는 마을: 정원 = 지금 주민 수 (진행률이 예전과 똑같이 보이게). 가장 작은 값은 2
update public.villages v
   set capacity = greatest(2, (select count(*) from public.residents r where r.village_id = v.id));

alter table public.villages
  alter column capacity set not null,
  add constraint villages_capacity_check check (capacity between 2 and 30);

comment on column public.villages.capacity is
  '정원(목표 인원). 진행률의 기준 인원 = greatest(정원, 주민 수). 줄일 수 없고, 주민이 정원을 넘으면 자동으로 늘어납니다';

-- ---------------------------------------------------------------------------
-- 2. 마을 트리거: 정원은 줄일 수 없음 (기존 "종류·초대 코드·만든 사람 잠금"에 한 줄 추가)
-- ---------------------------------------------------------------------------
create or replace function private.villages_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'kind_locked';
  end if;
  if new.invite_code is distinct from old.invite_code
     or new.created_by is distinct from old.created_by then
    raise exception 'locked_column';
  end if;
  if new.capacity < old.capacity then
    raise exception 'capacity_cannot_shrink';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 주민 트리거: 커플 2명·친구 30명까지만, 정원을 넘으면 정원을 올림
-- ---------------------------------------------------------------------------
create or replace function private.residents_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text;
  v_capacity int;
  v_count int;
begin
  -- for update: 두 사람이 동시에 들어와도 한 명씩 차례로 세도록 마을 줄을 잠깐 잠급니다
  select v.kind, v.capacity into v_kind, v_capacity
    from public.villages v where v.id = new.village_id for update;
  select count(*)::int into v_count from public.residents r where r.village_id = new.village_id;

  if v_kind = 'couple' and v_count >= 2 then
    raise exception 'couple_full';
  end if;
  -- 친구 마을은 30명까지 (⚠️ 화면 쪽 값: lib/villages/rules.ts의 VILLAGE_CAPACITY_MAX)
  if v_kind = 'friends' and v_count >= 30 then
    raise exception 'village_full';
  end if;

  -- 이 사람이 들어오면 정원을 넘는 경우: 정원을 그 인원으로 올립니다 (예: 정원 5명에 6번째 → 6명)
  if v_count + 1 > v_capacity then
    update public.villages set capacity = v_count + 1 where id = new.village_id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 마을 만들기: 정원을 함께 받음
-- ---------------------------------------------------------------------------
-- 인자가 늘어나므로 예전 함수를 지우고 새로 만듭니다.
-- p_capacity를 비워 두면(null) 친구 마을은 가장 작은 정원 3명으로 만듭니다.
--  → 새 화면이 배포되기 전의 옛 화면(정원을 보내지 않음)에서도 마을 만들기가 깨지지 않게 하는 장치입니다.
drop function public.create_village(text, text);

create function public.create_village(p_name text, p_kind text, p_capacity int default null)
returns public.villages
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_village public.villages;
  v_code text;
  v_capacity int;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  -- 커플 마을은 언제나 2명. 친구 마을은 3~30명
  if p_kind = 'couple' then
    v_capacity := 2;
  else
    v_capacity := coalesce(p_capacity, 3);
    if v_capacity < 3 or v_capacity > 30 then
      raise exception 'invalid_capacity';
    end if;
  end if;

  -- 초대 코드: 헷갈리는 글자(0·O·1·l·I)를 뺀 글자 중 무작위 12자. 겹치면 다시 뽑습니다
  loop
    select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '')
      into v_code
      from generate_series(1, 12);
    exit when not exists (select 1 from public.villages v where v.invite_code = v_code);
  end loop;

  insert into public.villages (name, kind, invite_code, created_by, capacity)
  values (btrim(p_name), p_kind, v_code, v_uid, v_capacity)
  returning * into v_village;

  insert into public.residents (village_id, user_id) values (v_village.id, v_uid);

  return v_village;
end;
$$;

revoke execute on function public.create_village(text, text, int) from public, anon;
grant execute on function public.create_village(text, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 장식 단계 계산: 기준 인원 = greatest(정원, 주민 수)
-- ---------------------------------------------------------------------------
drop function private.decor_level(text, int, int);

create function private.decor_level(p_kind text, p_residents int, p_done int, p_capacity int)
returns int
language sql immutable set search_path = ''
as $$
  select case
    when p_kind = 'couple' then
      case when p_residents = 2 then least(10, greatest(p_done, 0) * 10 / 10) else 0 end
    when greatest(p_residents, coalesce(p_capacity, 0)) < 2 then 0
    else least(10, greatest(p_done, 0) * 10
      / (greatest(p_residents, coalesce(p_capacity, 0)) * (greatest(p_residents, coalesce(p_capacity, 0)) - 1)))
  end;
$$;

/** 마을 하나의 지금 장식 단계를 구해서, 기록(최고 단계·대왕별 시각)을 넘었으면 올려 적습니다 */
create or replace function private.refresh_village_peak(p_village uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text;
  v_capacity int;
  v_residents int;
  v_done int;
  v_level int;
begin
  -- for update: 두 사람이 동시에 편지를 보내도 한 명씩 차례로 세도록 마을 줄을 잠깐 잠급니다
  select v.kind, v.capacity into v_kind, v_capacity from public.villages v where v.id = p_village for update;
  if v_kind is null then
    return;
  end if;

  -- 세는 기준은 village_progress와 같습니다 (삭제되지 않은 편지 + 커플 마을이면 질문지 답)
  select count(*)::int into v_residents from public.residents r where r.village_id = p_village;
  select count(*)::int into v_done from public.letters l where l.village_id = p_village and l.deleted_at is null;
  if v_kind = 'couple' then
    v_done := v_done + (select count(*)::int from public.couple_answers a where a.village_id = p_village);
  end if;

  v_level := private.decor_level(v_kind, v_residents, v_done, v_capacity);

  update public.villages v
     set max_decor_level = greatest(v.max_decor_level, v_level),
         -- 처음 10단계에 닿은 시각만 적습니다 (내려갔다가 다시 올라와도 처음 시각 그대로)
         star_attached_at = coalesce(v.star_attached_at, case when v_level >= 10 then now() end)
   where v.id = p_village
     and (v.max_decor_level < v_level or (v_level >= 10 and v.star_attached_at is null));
end;
$$;

revoke execute on function private.decor_level(text, int, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. 진행률 숫자: 정원도 함께 돌려줌 (돌려주는 칸이 바뀌므로 지우고 새로 만듭니다)
-- ---------------------------------------------------------------------------
drop function public.village_progress(uuid);

create function public.village_progress(p_village uuid)
returns table (resident_count int, done_count int, capacity int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_resident(p_village) then
    raise exception 'not_resident';
  end if;

  return query
  select
    (select count(*)::int from public.residents r where r.village_id = p_village),
    (select count(*)::int from public.letters l where l.village_id = p_village and l.deleted_at is null)
    + (
      select case when v.kind = 'couple'
        then (select count(*)::int from public.couple_answers a where a.village_id = p_village)
        else 0 end
      from public.villages v where v.id = p_village
    ),
    (select v.capacity::int from public.villages v where v.id = p_village);
end;
$$;

revoke execute on function public.village_progress(uuid) from public, anon;
grant execute on function public.village_progress(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. 내 마을 목록: 정원도 함께 돌려줌
-- ---------------------------------------------------------------------------
drop function public.my_villages();

create function public.my_villages()
returns table (
  id uuid,
  name text,
  kind text,
  resident_count int,
  done_count int,
  joined_at timestamptz,
  my_nickname text,
  capacity int
)
language sql stable security definer set search_path = ''
as $$
  select
    v.id,
    v.name,
    v.kind,
    (select count(*)::int from public.residents r2 where r2.village_id = v.id),
    (select count(*)::int from public.letters l where l.village_id = v.id and l.deleted_at is null)
      + case when v.kind = 'couple'
          then (select count(*)::int from public.couple_answers a where a.village_id = v.id)
          else 0 end,
    r.joined_at,
    -- 이 마을에서 쓰는 이름. 따로 정하지 않았으면 로그인 닉네임
    coalesce(r.nickname, (select u.name from public.users u where u.id = r.user_id)),
    v.capacity::int
  from public.residents r
  join public.villages v on v.id = r.village_id
  where r.user_id = (select auth.uid())
  -- 가장 최근에 입주한 마을이 맨 앞
  order by r.joined_at desc;
$$;

comment on function public.my_villages() is '내가 속한 마을 목록 (이름·종류·주민 수·쓴 개수·입주 시각·내 닉네임·정원). 최근 입주 순';

revoke execute on function public.my_villages() from public, anon;
grant execute on function public.my_villages() to authenticated;

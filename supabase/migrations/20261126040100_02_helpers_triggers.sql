-- ============================================================================
-- 02. 도우미 함수와 트리거 — 로드맵 Task 006-2
-- 설계 근거: docs/db-design.md 3장 "데이터베이스가 직접 지키는 규칙"
-- ============================================================================
--
-- 💡 트리거: 표에 줄을 넣거나 고칠 때 데이터베이스가 스스로 실행하는 작은 프로그램입니다.
--    화면 코드는 누군가 조작할 수 있지만, 트리거는 우회할 수 없습니다.
-- 💡 security definer: 함수를 "부른 사람"이 아니라 "만든 사람(관리자)" 권한으로 실행합니다.
--    보안 규칙(RLS)에 막히지 않고 확인만 해 주는 도우미에 씁니다. 그래서 화면에서 부를 수 없는 private에 둡니다.
-- 💡 set search_path = '': 함수 안에서 표 이름을 찾을 때 엉뚱한 곳을 보지 않도록, 항상 "public.표이름"처럼 적게 합니다.
--
-- 오류 문구는 화면이 구분하기 쉽도록 짧은 영문 코드로 통일합니다:
--   not_resident(주민 아님) / couple_full(커플 마을 정원 초과) / kind_locked(마을 종류 변경 불가)
--   locked_column(바꿀 수 없는 칸) / not_couple_village(커플 마을 아님)

-- ---------------------------------------------------------------------------
-- 1. 도우미 함수 (보안 규칙이 부릅니다)
-- ---------------------------------------------------------------------------

/** 지금 로그인한 사람이 이 마을의 주민인지 */
create function private.is_resident(p_village uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.residents r
    where r.village_id = p_village and r.user_id = (select auth.uid())
  );
$$;

/** 지금 로그인한 사람과 p_user가 같은 마을에 함께 사는지 (이웃의 이름을 읽을 때 씀) */
create function private.shares_village(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.residents mine
    join public.residents theirs on theirs.village_id = mine.village_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user
  );
$$;

/**
 * 편지 잠금이 풀리는 시각. 읽기·쓰기 규칙이 모두 이 함수 하나만 봅니다.
 *  - 기본: 한국·일본 시간 2026년 12월 25일 0시 (화면 쪽 짝: lib/letters/rules.ts의 isLetterLocked)
 *  - 개발용(PRD 가정 23): private.app_config에 unlock_override 줄이 있으면 그 시각을 씁니다
 *      앞당기기:  insert into private.app_config values ('unlock_override', '2026-11-01T00:00:00+09:00')
 *                   on conflict (key) do update set value = excluded.value;
 *      되돌리기:  delete from private.app_config where key = 'unlock_override';
 */
create function private.unlock_time()
returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select c.value::timestamptz from private.app_config c where c.key = 'unlock_override'),
    timestamptz '2026-12-25 00:00:00+09'
  );
$$;

-- 보안 규칙은 "로그인한 사람" 자격으로 평가되므로, 이 세 함수만 실행할 수 있게 열어 줍니다.
-- (private은 화면용 주소(Data API)에 노출되지 않아서 브라우저에서 직접 부를 수는 없습니다)
grant usage on schema private to authenticated;
grant execute on function private.is_resident(uuid) to authenticated;
grant execute on function private.shares_village(uuid) to authenticated;
grant execute on function private.unlock_time() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 편지 트리거
-- ---------------------------------------------------------------------------

/** 편지를 넣기 전: 화면이 보낸 시각 값은 버리고, 보낸·받는 사람이 모두 그 마을 주민인지 확인 */
create function private.letters_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- 화면이 unlock_at을 과거로 넣어 잠금을 푸는 일을 막습니다
  new.unlock_at := private.unlock_time();
  new.created_at := now();
  new.edited_at := null;
  new.deleted_at := null;
  new.opened_at := null;

  if not exists (select 1 from public.residents r where r.village_id = new.village_id and r.user_id = new.sender_id)
     or not exists (select 1 from public.residents r where r.village_id = new.village_id and r.user_id = new.recipient_id) then
    raise exception 'not_resident';
  end if;
  return new;
end;
$$;

create trigger letters_before_insert
  before insert on public.letters
  for each row execute function private.letters_before_insert();

/** 편지를 고치기 전: 누가 누구에게 보냈는지 같은 "바꾸면 안 되는 칸"을 지킵니다 */
create function private.letters_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.village_id is distinct from old.village_id
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.unlock_at is distinct from old.unlock_at
     or new.created_at is distinct from old.created_at then
    raise exception 'locked_column';
  end if;
  -- 내용이나 편지지가 바뀌면 수정 시각을 데이터베이스 시계로 적습니다 (화면 시계는 믿지 않음)
  if new.content is distinct from old.content or new.paper is distinct from old.paper then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger letters_before_update
  before update on public.letters
  for each row execute function private.letters_before_update();

-- ---------------------------------------------------------------------------
-- 3. 주민 트리거: 커플 마을은 2명까지만
-- ---------------------------------------------------------------------------
create function private.residents_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text;
begin
  -- for update: 두 사람이 동시에 들어와도 한 명씩 차례로 세도록 마을 줄을 잠깐 잠급니다
  select v.kind into v_kind from public.villages v where v.id = new.village_id for update;
  if v_kind = 'couple'
     and (select count(*) from public.residents r where r.village_id = new.village_id) >= 2 then
    raise exception 'couple_full';
  end if;
  return new;
end;
$$;

create trigger residents_before_insert
  before insert on public.residents
  for each row execute function private.residents_before_insert();

-- ---------------------------------------------------------------------------
-- 4. 마을 트리거: 종류·초대 코드·만든 사람은 만든 뒤 바꿀 수 없음
-- ---------------------------------------------------------------------------
create function private.villages_before_update()
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
  return new;
end;
$$;

create trigger villages_before_update
  before update on public.villages
  for each row execute function private.villages_before_update();

-- ---------------------------------------------------------------------------
-- 5. 질문지 답 트리거: 커플 마을의 주민만
-- ---------------------------------------------------------------------------
create function private.couple_answers_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.unlock_at := private.unlock_time();
  new.created_at := now();
  if not exists (select 1 from public.villages v where v.id = new.village_id and v.kind = 'couple') then
    raise exception 'not_couple_village';
  end if;
  if not exists (select 1 from public.residents r where r.village_id = new.village_id and r.user_id = new.author_id) then
    raise exception 'not_resident';
  end if;
  return new;
end;
$$;

create trigger couple_answers_before_insert
  before insert on public.couple_answers
  for each row execute function private.couple_answers_before_insert();

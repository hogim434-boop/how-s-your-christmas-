-- ============================================================================
-- 04. 화면이 부르는 DB 함수(RPC) — 로드맵 Task 006-4
-- 설계 근거: docs/db-design.md 3장(마을 만들기), 4장(진행률), 5장(초대·잠긴 편지 목록)
-- ============================================================================
--
-- 💡 RPC: 화면 코드가 supabase.rpc('함수이름', {...})으로 부르는 데이터베이스 함수입니다.
--    보안 규칙만으로는 할 수 없는 일(두 표에 한 번에 저장, 내용 없이 숫자만 세기 등)을 맡깁니다.
--
-- 모든 함수는 security definer(관리자 권한으로 실행)라서, 함수 안에서 "부른 사람이 누구인지"를
-- 반드시 직접 확인합니다. 실행 권한은 로그인한 사람(authenticated)에게만 줍니다.
-- 예외: village_name_by_invite는 로그인 전 초대 화면에서 쓰므로 anon에게도 줍니다.
--
-- 오류 코드: not_signed_in(로그인 안 함) / invalid_invite(없는 초대 코드) / not_resident(주민 아님)
--           not_found(없거나 내 것이 아님) / closed(12.25부터 마감) / still_locked(아직 잠김)

-- ---------------------------------------------------------------------------
-- 1. 마을 만들기: 마을 + 첫 주민(만든 사람)을 한 번에 저장하고 초대 코드를 발급
-- ---------------------------------------------------------------------------
create function public.create_village(p_name text, p_kind text)
returns public.villages
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_village public.villages;
  v_code text;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  -- 초대 코드: 헷갈리는 글자(0·O·1·l·I)를 뺀 글자 중 무작위 12자. 겹치면 다시 뽑습니다
  loop
    select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '')
      into v_code
      from generate_series(1, 12);
    exit when not exists (select 1 from public.villages v where v.invite_code = v_code);
  end loop;

  insert into public.villages (name, kind, invite_code, created_by)
  values (btrim(p_name), p_kind, v_code, v_uid)
  returning * into v_village;

  insert into public.residents (village_id, user_id) values (v_village.id, v_uid);

  return v_village;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. 초대 코드로 입주: 처음이면 주민으로 추가, 이미 주민이면 그대로 (집이 늘지 않음)
-- ---------------------------------------------------------------------------
create function public.join_village(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_village uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  select v.id into v_village from public.villages v where v.invite_code = p_code;
  if v_village is null then
    raise exception 'invalid_invite';
  end if;

  -- 이미 주민이면 아무 일도 하지 않습니다. 커플 마을 2명 제한은 02 파일의 트리거가 확인합니다
  if not exists (select 1 from public.residents r where r.village_id = v_village and r.user_id = v_uid) then
    insert into public.residents (village_id, user_id) values (v_village, v_uid);
  end if;

  return v_village;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 초대 화면용: 초대 코드로 마을 이름과 종류만 돌려줌 (로그인 전에도 사용)
-- ---------------------------------------------------------------------------
create function public.village_name_by_invite(p_code text)
returns table (name text, kind text)
language sql stable security definer set search_path = ''
as $$
  select v.name, v.kind from public.villages v where v.invite_code = p_code;
$$;

-- ---------------------------------------------------------------------------
-- 4. 진행률 계산용 숫자: 주민 수와 "한 일" 수만 (편지 내용은 돌려주지 않음)
-- ---------------------------------------------------------------------------
-- 화면은 이 숫자를 lib/decor/progress.ts의 계산식에 넣어 장식 단계를 구합니다.
--  - 친구 마을: 한 일 = 삭제되지 않은 편지 수
--  - 커플 마을: 한 일 = 질문지 답 수 + 삭제되지 않은 편지 수
create function public.village_progress(p_village uuid)
returns table (resident_count int, done_count int)
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
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. 잠긴 받은 편지 목록: 내가 받은 편지가 "몇 통, 언제 왔는지"만
-- ---------------------------------------------------------------------------
-- 내용과 보낸 사람은 돌려주지 않습니다. 화면에서만 숨기면 개발자 도구로 보이기 때문입니다.
-- (결정 대기: PRD는 "보낸 사람 이름 표시"이고 지금 화면은 12.25 전 이름을 숨깁니다.
--  이름을 보여 주기로 하면 이 함수의 돌려주는 칸에 sender_id만 추가하면 됩니다)
create function public.received_letters_locked(p_village uuid)
returns table (id uuid, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select l.id, l.created_at
  from public.letters l
  where l.village_id = p_village
    and l.recipient_id = (select auth.uid())
    and l.deleted_at is null
  order by l.created_at;
$$;

-- ---------------------------------------------------------------------------
-- 6. 편지 삭제(숨김): 진짜 지우지 않고 deleted_at에 시각을 적습니다
-- ---------------------------------------------------------------------------
create function public.delete_letter(p_letter uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.letters l
    where l.id = p_letter and l.sender_id = v_uid and l.deleted_at is null
  ) then
    raise exception 'not_found';
  end if;

  -- [D-12 결정 대기] 12.25부터 삭제도 막을지. 지금은 "막음"(쓰기·수정과 같은 마감).
  -- 삭제는 계속 허용하기로 하면 아래 if 블록 세 줄만 지우면 됩니다.
  if now() >= private.unlock_time() then
    raise exception 'closed';
  end if;

  update public.letters set deleted_at = now() where id = p_letter;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. 편지 열어 봄 기록: 받는 사람이 잠금 해제 뒤 처음 열 때만 시각을 적습니다 (성공 지표용)
-- ---------------------------------------------------------------------------
create function public.mark_letter_opened(p_letter uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.letters l
    where l.id = p_letter and l.recipient_id = v_uid and l.deleted_at is null
  ) then
    raise exception 'not_found';
  end if;
  if now() < private.unlock_time() then
    raise exception 'still_locked';
  end if;

  -- 이미 열어 본 편지는 처음 시각을 그대로 둡니다
  update public.letters set opened_at = now() where id = p_letter and opened_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 실행 권한: 기본으로 붙는 "누구나 실행" 권한을 거두고, 필요한 역할에만 줍니다
-- ---------------------------------------------------------------------------
revoke execute on function
  public.create_village(text, text),
  public.join_village(text),
  public.village_name_by_invite(text),
  public.village_progress(uuid),
  public.received_letters_locked(uuid),
  public.delete_letter(uuid),
  public.mark_letter_opened(uuid)
from public, anon;

grant execute on function
  public.create_village(text, text),
  public.join_village(text),
  public.village_name_by_invite(text),
  public.village_progress(uuid),
  public.received_letters_locked(uuid),
  public.delete_letter(uuid),
  public.mark_letter_opened(uuid)
to authenticated;

-- 초대 화면은 로그인 전에도 마을 이름을 보여 줘야 합니다
grant execute on function public.village_name_by_invite(text) to anon;

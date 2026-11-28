-- 08. 내가 들어간 마을 목록 (로드맵 Task 017, F017 마을 목록·전환)
--
-- 마을 목록 창에서 "내가 속한 마을들"을 이름·종류·주민 수·쓴 개수와 함께 한 번에 받기 위한 함수입니다.
-- 마을마다 village_progress를 따로 부르면 마을 수만큼 왕복이 생기므로 하나로 묶었습니다.
--
-- 💡 보안: security definer(함수 주인의 권한으로 실행)이지만, 맨 처음에 "지금 로그인한 사람의 주민 줄"로만
--    거르기 때문에 남의 마을은 한 줄도 나오지 않습니다. 로그인하지 않은 사람(anon)은 실행할 수 없습니다.
-- 💡 세는 기준은 04 파일의 village_progress와 같습니다 (삭제되지 않은 편지 + 커플 마을이면 질문지 답).
--    ⚠️ 그 기준을 바꾸면 이 함수도 함께 고칩니다.

create function public.my_villages()
returns table (
  id uuid,
  name text,
  kind text,
  resident_count int,
  done_count int,
  joined_at timestamptz,
  my_nickname text
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
    coalesce(r.nickname, (select u.name from public.users u where u.id = r.user_id))
  from public.residents r
  join public.villages v on v.id = r.village_id
  where r.user_id = (select auth.uid())
  -- 가장 최근에 입주한 마을이 맨 앞
  order by r.joined_at desc;
$$;

comment on function public.my_villages() is '내가 속한 마을 목록 (이름·종류·주민 수·쓴 개수·입주 시각·내 닉네임). 최근 입주 순';

revoke execute on function public.my_villages() from public, anon;
grant execute on function public.my_villages() to authenticated;

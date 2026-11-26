-- 06. 마을마다 따로 정하는 닉네임 (11.27 사용자 요청)
--
-- 지금까지는 LINE·카카오의 닉네임(users.name)이 그대로 보였습니다.
-- 이제 마을에 처음 들어올 때 "이 마을에서 쓸 이름"을 따로 정할 수 있습니다.
-- 캐릭터 꾸미기 값처럼 주민 줄(residents)에 마을마다 따로 저장합니다.
--
-- 💡 비어 있으면(null) 로그인 닉네임을 그대로 씁니다. 그래서 이미 입주한 사람은 아무 일도 하지 않아도 됩니다.

alter table public.residents
  -- 1~10자. ⚠️ 화면 쪽 값은 lib/village/nickname.ts의 NICKNAME_MAX. 바꿀 때 함께 고칩니다
  add column nickname text
    check (nickname is null or (char_length(btrim(nickname)) >= 1 and char_length(nickname) <= 10));

comment on column public.residents.nickname is '이 마을에서 쓰는 이름. 비어 있으면 users.name(로그인 닉네임)을 씁니다';

-- 본인 줄의 닉네임 칸도 고칠 수 있게 엽니다 ("본인 줄만" 고치는 규칙은 03 파일에 이미 있습니다)
grant update (nickname) on public.residents to authenticated;

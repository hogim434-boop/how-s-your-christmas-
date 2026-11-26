-- ============================================================================
-- 03. 보안 규칙(RLS)과 권한 — 로드맵 Task 006-3
-- 설계 근거: docs/db-design.md 5장
-- ============================================================================
--
-- 자물쇠가 두 겹입니다. 둘 다 통과해야 읽거나 쓸 수 있어요.
--  ① 권한(grant):   "이 표의 이 칸을 읽어도/써도 되는 역할인가?"  (표·칸 단위)
--  ② 보안 규칙(RLS): "이 줄을 읽어도/써도 되는 사람인가?"        (줄 단위)
--
-- 역할
--  - anon: 로그인하지 않은 사람 → 표 권한을 하나도 주지 않습니다
--  - authenticated: 로그인한 사람 → 아래에서 필요한 것만 줍니다
--  - service_role: 서버가 비밀 키로 접속할 때. 보안 규칙을 건너뜁니다 (알림 보내기 등)
--
-- 규칙을 만들지 않은 표(user_secrets, notification_logs, private.app_config)는
-- 화면에서 읽을 수도 쓸 수도 없습니다.
--
-- ⚠️ 규칙 안에서 residents 표를 직접 조회하면 "규칙이 규칙을 다시 부르는" 무한 반복 오류가 납니다.
--    그래서 주민 확인은 반드시 private.is_resident() 같은 도우미 함수로 합니다.

-- ---------------------------------------------------------------------------
-- users — 본인과, 같은 마을 이웃의 정보만 읽기. 고치는 건 본인 이름만
-- ---------------------------------------------------------------------------
grant select on public.users to authenticated;
grant update (name) on public.users to authenticated;

create policy "본인과 같은 마을 이웃만 읽기" on public.users
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_village(id));

create policy "본인 줄만 고치기" on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- villages — 그 마을 주민만 읽기. 만들기·입주는 04 파일의 함수로만
-- ---------------------------------------------------------------------------
grant select on public.villages to authenticated;

create policy "주민만 마을 읽기" on public.villages
  for select to authenticated
  using (private.is_resident(id));

-- ---------------------------------------------------------------------------
-- residents — 같은 마을 주민끼리 읽기. 고치는 건 본인의 캐릭터 꾸미기 값만
-- ---------------------------------------------------------------------------
grant select on public.residents to authenticated;
grant update (character_parts) on public.residents to authenticated;

create policy "같은 마을 주민만 읽기" on public.residents
  for select to authenticated
  using (private.is_resident(village_id));

create policy "본인 꾸미기 값만 고치기" on public.residents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- letters — 이 서비스에서 가장 중요한 규칙
-- ---------------------------------------------------------------------------
-- 쓸 수 있는 칸만 엽니다. unlock_at·opened_at·deleted_at 같은 칸은 화면이 직접 넣거나 고칠 수 없습니다.
grant select on public.letters to authenticated;
grant insert (village_id, sender_id, recipient_id, content, paper) on public.letters to authenticated;
grant update (content, paper) on public.letters to authenticated;
-- delete 권한은 주지 않습니다 → 진짜 삭제는 누구도 못 합니다 (숨김 삭제는 04 파일의 delete_letter 함수)

-- 읽기: 보낸 사람은 언제나 / 받는 사람은 잠금 시각이 지난 뒤에만 / 그 밖의 사람은 못 읽음
-- 삭제(숨김)된 편지는 양쪽 모두에게 보이지 않습니다 (PRD 가정 17)
create policy "보낸 사람은 언제나, 받는 사람은 잠금 해제 뒤에만 읽기" on public.letters
  for select to authenticated
  using (
    deleted_at is null
    and (
      sender_id = (select auth.uid())
      or (recipient_id = (select auth.uid()) and now() >= (select private.unlock_time()))
    )
  );

-- 쓰기: 내 이름으로만, 그 마을 주민만, 잠금 시각 전까지만
-- (받는 사람도 주민인지는 02 파일의 트리거가, 한 사람에게 한 통은 01 파일의 유일 인덱스가 확인합니다)
create policy "주민이 잠금 전까지만 편지 쓰기" on public.letters
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.is_resident(village_id)
    and now() < (select private.unlock_time())
  );

-- 수정: 보낸 사람 본인이, 잠금 시각 전까지만
create policy "보낸 사람이 잠금 전까지만 고치기" on public.letters
  for update to authenticated
  using (
    sender_id = (select auth.uid())
    and deleted_at is null
    and now() < (select private.unlock_time())
  )
  with check (sender_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- couple_answers — 편지와 같은 모양 (표만 만들어 둠. 화면 연결은 12.3 이후)
-- ---------------------------------------------------------------------------
grant select on public.couple_answers to authenticated;
grant insert (village_id, author_id, question_no, content) on public.couple_answers to authenticated;
grant update (content) on public.couple_answers to authenticated;

create policy "쓴 사람은 언제나, 상대는 잠금 해제 뒤에만 읽기" on public.couple_answers
  for select to authenticated
  using (
    author_id = (select auth.uid())
    or (private.is_resident(village_id) and now() >= (select private.unlock_time()))
  );

create policy "커플 마을 주민이 잠금 전까지만 답 쓰기" on public.couple_answers
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.is_resident(village_id)
    and now() < (select private.unlock_time())
  );

create policy "쓴 사람이 잠금 전까지만 답 고치기" on public.couple_answers
  for update to authenticated
  using (author_id = (select auth.uid()) and now() < (select private.unlock_time()))
  with check (author_id = (select auth.uid()));

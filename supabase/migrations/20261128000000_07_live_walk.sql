-- ============================================================================
-- 07. 함께 걷기: 실시간 채널 권한 — 로드맵 Task 025-4
-- ============================================================================
--
-- 💡 실시간 채널: 같은 마을에 동시에 접속한 주민끼리 "어디로 걸어가는지"를 주고받는 통로입니다.
--    마을마다 통로가 하나씩 있고, 이름(주제)은 "village:<마을 번호>" 입니다.
-- 💡 비공개 채널: 아무나 들어올 수 없고, 아래 보안 규칙을 통과한 사람만 들어올 수 있는 통로입니다.
--    Supabase는 "realtime.messages 표를 읽을 수 있는가(= 들을 수 있는가)",
--    "넣을 수 있는가(= 보낼 수 있는가)"로 이것을 판단합니다.
--    (실제로 이 표에 걷기 정보가 쌓이는 것은 아닙니다. 권한을 확인하는 용도로만 쓰입니다)
--
-- 🚨 비상 차단: 아래 규칙 2개를 지우면, 화면을 다시 배포하지 않아도 함께 걷기가 즉시 꺼집니다.
--    (걷기·편지 등 다른 기능은 그대로 동작합니다. 이미 들어와 있는 연결은 다시 연결할 때부터 막힙니다)
--      drop policy "마을 주민만 실시간 채널 듣기" on realtime.messages;
--      drop policy "마을 주민만 실시간 채널 보내기" on realtime.messages;

-- ---------------------------------------------------------------------------
-- 1. 도우미 함수 (보안 규칙이 부릅니다)
-- ---------------------------------------------------------------------------

/**
 * 지금 로그인한 사람이 이 채널 주제(village:<마을 번호>)의 마을 주민인지.
 *  - 주제가 정해진 모양(village: + 마을 번호 36자)과 정확히 같을 때만 주민인지 확인합니다.
 *  - 모양이 다르면 마을 번호로 바꾸는 과정에서 오류가 나므로, 바꾸기 전에 걸러서 "아니오"로 답합니다.
 *    (case는 위에서부터 차례로 확인하므로, 모양이 맞을 때만 번호로 바꿉니다)
 */
create function private.is_village_topic_resident(p_topic text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when p_topic ~ '^village:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.is_resident(substring(p_topic from 9)::uuid)
    else false
  end;
$$;

-- 이 프로젝트는 새 함수에 실행 권한이 자동으로 붙지 않으므로 직접 줍니다.
-- 보안 규칙은 "로그인한 사람" 자격으로 평가되므로 authenticated에만 엽니다.
revoke all on function private.is_village_topic_resident(text) from public;
grant execute on function private.is_village_topic_resident(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 보안 규칙 — 그 마을 주민만 듣고 보낼 수 있습니다
-- ---------------------------------------------------------------------------
-- extension: broadcast(걸어갈 곳 알리기)와 presence(접속 중 표시)만 허용합니다.
-- (select realtime.topic()): 지금 들어오려는 채널의 주제를 돌려줍니다.

create policy "마을 주민만 실시간 채널 듣기" on realtime.messages
  for select to authenticated
  using (
    extension in ('broadcast', 'presence')
    and private.is_village_topic_resident((select realtime.topic()))
  );

create policy "마을 주민만 실시간 채널 보내기" on realtime.messages
  for insert to authenticated
  with check (
    extension in ('broadcast', 'presence')
    and private.is_village_topic_resident((select realtime.topic()))
  );

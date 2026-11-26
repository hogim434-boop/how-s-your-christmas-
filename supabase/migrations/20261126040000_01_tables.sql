-- ============================================================================
-- 01. 표(테이블) 만들기 — 로드맵 Task 006-1
-- 설계 근거: docs/db-design.md 2장 / 타입 짝: types/domain.ts
-- ============================================================================
--
-- 💡 이 파일은 "마이그레이션"입니다. 데이터베이스를 어떻게 바꿨는지 순서대로 적어 두는 기록이에요.
--    파일 이름 앞의 숫자 순서대로 한 번씩만 실행됩니다.
--
-- 시작 전에 공식 문서와 실제 프로젝트를 확인한 내용 (2026-11-26)
--  1) 이 프로젝트는 public 안에 표·함수를 만들면 anon(로그인 안 한 사람)·authenticated(로그인한 사람)에게
--     읽기·쓰기·실행 권한이 "자동으로" 붙습니다. (pg_default_acl 조회로 확인)
--     → 실수로 새 표가 바로 공개되지 않도록, 아래에서 이 자동 권한을 먼저 끕니다.
--       그 뒤로는 필요한 권한만 03_rls.sql에서 직접 줍니다.
--       https://supabase.com/docs/guides/api/securing-your-api
--  2) 다른 사람 권한으로 실행되는 함수(security definer)는 화면에 노출되지 않는 private 스키마에 두고,
--     search_path를 빈 값으로 고정합니다.
--  3) 보안 규칙 안의 auth.uid()는 (select auth.uid())로 감쌉니다. 줄마다 다시 계산하지 않아 빠릅니다.
--     https://supabase.com/docs/guides/database/postgres/row-level-security

-- ---------------------------------------------------------------------------
-- 0. 자동 권한 끄기 + 숨겨 둘 공간(private 스키마) 만들기
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated;
-- Postgres는 새 함수를 "누구나(public)" 실행할 수 있게 만드는 것이 기본값이라, 이것도 끕니다
alter default privileges for role postgres revoke execute on functions from public;

-- private: 화면(브라우저)에서는 들여다볼 수 없는 공간. 도우미 함수와 개발용 설정을 둡니다
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. users — 사용자 (로그인 계정 auth.users와 1:1 짝)
-- ---------------------------------------------------------------------------
create table public.users (
  -- 로그인 계정과 같은 번호. 로그인 계정이 지워지면 이 줄도 함께 지워집니다
  id uuid primary key references auth.users (id) on delete cascade,
  auth_provider text not null check (auth_provider in ('line', 'kakao')),
  provider_user_id text not null,
  -- 편지에 보이는 이름
  name text not null check (char_length(name) between 1 and 50),
  line_notify_id text,
  created_at timestamptz not null default now(),
  unique (auth_provider, provider_user_id)
);
comment on table public.users is '사용자. 처음 로그인할 때 서버 코드(Task 007)가 한 줄을 만듭니다';

-- 비밀 값은 따로 둡니다. 보안 규칙을 하나도 만들지 않아서 화면에서는 읽을 수도 쓸 수도 없습니다
create table public.user_secrets (
  user_id uuid primary key references public.users (id) on delete cascade,
  kakao_message_token text
);
comment on table public.user_secrets is '사용자 비밀 값(카카오 알림 토큰). 서버(비밀 키)만 읽습니다';

-- ---------------------------------------------------------------------------
-- 2. villages — 마을
-- ---------------------------------------------------------------------------
create table public.villages (
  id uuid primary key default gen_random_uuid(),
  -- 모임 이름 1~20자. ⚠️ 화면 쪽 값은 lib/villages/rules.ts의 VILLAGE_NAME_MAX. 바꿀 때 함께 고칩니다
  name text not null check (char_length(btrim(name)) >= 1 and char_length(name) <= 20),
  -- 마을 종류. 만든 뒤에는 바꿀 수 없습니다 (02 파일의 트리거가 막음)
  kind text not null check (kind in ('friends', 'couple')),
  -- 초대 링크에 쓰는 값. 추측하기 어려운 무작위 글자
  invite_code text not null unique,
  created_by uuid not null references public.users (id),
  -- 지금까지 가장 높았던 장식 단계. 알림을 두 번 보내지 않기 위한 값일 뿐, 화면 장식은 진행률로 계산합니다
  max_decor_level int not null default 0 check (max_decor_level between 0 and 10),
  star_attached_at timestamptz,
  photo_save_count int not null default 0 check (photo_save_count >= 0),
  created_at timestamptz not null default now()
);
create index villages_created_by_idx on public.villages (created_by);

-- ---------------------------------------------------------------------------
-- 3. residents — 주민 (마을별 내 집)
-- ---------------------------------------------------------------------------
create table public.residents (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  -- 캐릭터 꾸미기 값 {hair, top, bottom, hat, scarf, gloves}. 마을마다 따로 저장
  character_parts jsonb,
  joined_at timestamptz not null default now(),
  -- 같은 사람이 같은 마을에 두 번 입주하지 못합니다 (초대 링크를 다시 눌러도 집이 늘지 않음)
  unique (village_id, user_id)
);
create index residents_user_id_idx on public.residents (user_id);

-- ---------------------------------------------------------------------------
-- 4. letters — 편지
-- ---------------------------------------------------------------------------
create table public.letters (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  recipient_id uuid not null references public.users (id) on delete cascade,
  -- 내용 1~500자. char_length는 이모지도 1자로 셉니다 (화면 코드와 같은 방식)
  -- ⚠️ 화면 쪽 값은 lib/letters/rules.ts의 LETTER_MAX_LENGTH. 바꿀 때 함께 고칩니다
  content text not null check (char_length(btrim(content)) >= 1 and char_length(content) <= 500),
  -- 편지지 종류. ⚠️ 화면 쪽 값은 lib/letters/papers.ts의 PAPER_KEYS. 바꿀 때 함께 고칩니다
  paper text not null default 'plain' check (paper in ('plain', 'snow', 'tree', 'candy')),
  -- 잠금이 풀리는 시각의 "기록". 화면이 보낸 값은 무시하고 02 파일의 트리거가 채웁니다
  unlock_at timestamptz not null,
  edited_at timestamptz,
  -- 삭제 = 진짜 지우지 않고 이 칸에 시각을 적어 숨깁니다
  deleted_at timestamptz,
  -- 받는 사람이 처음 연 시각
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  -- 자기 자신에게는 쓸 수 없습니다
  constraint letters_not_to_self check (sender_id <> recipient_id)
);
-- 한 사람에게 한 통만. 삭제(숨김)한 편지는 세지 않으므로, 삭제한 뒤에는 다시 쓸 수 있습니다
create unique index letters_one_per_pair_idx
  on public.letters (village_id, sender_id, recipient_id)
  where deleted_at is null;
create index letters_recipient_idx on public.letters (recipient_id);
create index letters_sender_idx on public.letters (sender_id);

-- ---------------------------------------------------------------------------
-- 5. couple_answers — 커플 마을 질문지 답 (표만 만들어 둠. 사용은 12.3 이후)
-- ---------------------------------------------------------------------------
create table public.couple_answers (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  question_no int not null check (question_no between 1 and 4),
  content text not null check (char_length(btrim(content)) >= 1 and char_length(content) <= 500),
  unlock_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (village_id, author_id, question_no)
);
create index couple_answers_author_idx on public.couple_answers (author_id);

-- ---------------------------------------------------------------------------
-- 6. notification_logs — 알림 발송 기록 (표만 만들어 둠. 서버만 사용)
-- ---------------------------------------------------------------------------
create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  village_id uuid not null references public.villages (id) on delete cascade,
  kind text not null check (kind in ('new_ornament', 'unlock')),
  -- 새 장식 알림이면 몇 단계인지. 12.25 알림이면 비워 둠
  level int check (level between 1 and 10),
  sent_at timestamptz not null default now(),
  -- 같은 알림을 두 번 보내지 않습니다. (nulls not distinct: level이 비어 있어도 "같은 값"으로 봄)
  unique nulls not distinct (user_id, village_id, kind, level)
);
create index notification_logs_village_idx on public.notification_logs (village_id);

-- ---------------------------------------------------------------------------
-- 7. private.app_config — 개발용 설정 (PRD 가정 23: 잠금 시각 앞당기기)
-- ---------------------------------------------------------------------------
-- key = 'unlock_override' 줄에 시각을 넣으면 그 시각을 잠금 해제 시각으로 씁니다.
-- 화면에서는 접근할 수 없고, SQL 편집기나 비밀 키로만 바꿀 수 있습니다.
-- ⚠️ 운영 배포 전에는 이 표가 비어 있어야 합니다.
create table private.app_config (
  key text primary key,
  value text not null
);

-- ---------------------------------------------------------------------------
-- 8. 모든 표에 보안 규칙(RLS) 켜기
-- ---------------------------------------------------------------------------
-- 켜기만 하고 규칙을 하나도 만들지 않으면 "아무도 못 읽고 못 씀"이 됩니다. 규칙은 03_rls.sql에서 만듭니다.
alter table public.users enable row level security;
alter table public.user_secrets enable row level security;
alter table public.villages enable row level security;
alter table public.residents enable row level security;
alter table public.letters enable row level security;
alter table public.couple_answers enable row level security;
alter table public.notification_logs enable row level security;
alter table private.app_config enable row level security;

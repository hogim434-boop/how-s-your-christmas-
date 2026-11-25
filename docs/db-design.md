# How's your Christmas 데이터베이스 설계서

> **작성**: 2026-11-25 (로드맵 Task 003) · **상태**: 설계만, **아직 Supabase에 만들지 않음** (실제 생성은 Task 008)
> **근거**: `docs/prd.md` "데이터 모델"·핵심 규칙·가정 1~4·8·27, 11.25 결정(D-03·D-05·D-10)
> **코드 쪽 짝**: 타입 `types/domain.ts`, 계산 규칙 `lib/decor/progress.ts`, 장식표 `lib/decor/decorTable.ts`

---

## 0. 먼저 읽어 두면 좋은 말

| 말 | 뜻 |
|---|---|
| **표(테이블)** | 엑셀 시트 하나와 비슷합니다. 한 줄 = 정보 하나(예: 편지 한 통) |
| **칸(컬럼)** | 표의 세로줄. 예: 편지의 "내용", "보낸 사람" |
| **uuid** | 겹치지 않는 긴 고유 번호. 모든 줄의 `id`에 씁니다 |
| **text / int / timestamptz / jsonb** | 글자 / 정수 / 시간대가 붙은 날짜시간 / 여러 값을 묶은 꾸러미(JSON) |
| **→ 연결(외래 키)** | "이 칸의 값은 다른 표의 id여야 한다"는 약속. 없는 마을에 편지가 생기는 일을 막습니다 |
| **제약(constraint)** | 잘못된 값이 아예 저장되지 않게 막는 규칙. 예: 질문 번호는 1~4만 |
| **유일(unique)** | 같은 조합이 두 번 저장되지 않게 하는 규칙. 예: 한 마을에 같은 사람이 두 번 입주 금지 |
| **RLS (행 단위 보안)** | "이 줄은 누가 읽고 쓸 수 있는가"를 데이터베이스가 직접 검사하는 규칙. 화면 코드가 실수해도 남의 편지가 새지 않게 막는 마지막 자물쇠입니다 |
| **트리거 / DB 함수** | 저장할 때 데이터베이스가 스스로 실행하는 작은 프로그램 |

---

## 1. 11.25 결정과 바꿀 곳

| 번호 | 결정 | 이 설계서에 반영한 곳 | 결정이 또 바뀌면 고칠 곳 |
|---|---|---|---|
| **D-03** | 커플/친구 마을은 **마을 만들 때 고름**, 이후 변경 불가 | `villages.kind` + 커플 2명 제한 트리거 (3·5장) | `villages.kind`, `requiredCount()` |
| **D-05** | 캐릭터 꾸미기는 **마을마다 따로** | `residents.character_parts` (2.3) | `residents.character_parts`, `types/domain.ts` |
| **D-10** | 장식은 **지금 진행률을 따름** (줄어들 수 있음) | 장식 단계를 **저장하지 않음**. `max_decor_level`은 알림 중복 방지용만 (2.2, 4장) | `computeDecorLevel()`, `villages.max_decor_level` |

---

## 2. 표 6개

### 2.1 `users` — 사용자

Supabase 로그인 기능이 만든 계정(`auth.users`)과 1:1로 짝을 이룹니다. 처음 로그인할 때 한 줄이 생깁니다.

| 칸 | DB 타입 | 기본값 / 규칙 | 설명 |
|---|---|---|---|
| id | uuid | **→ auth.users.id**, 기본 키 | 로그인 계정과 같은 번호 |
| auth_provider | text | `'line'` 또는 `'kakao'`만 (check) | 로그인 수단 |
| provider_user_id | text | 비울 수 없음, `(auth_provider, provider_user_id)` 유일 | LINE·카카오 계정 식별값 |
| name | text | 비울 수 없음 | 편지에 보이는 이름 |
| line_notify_id | text | 비워도 됨 | LINE 알림용 |
| created_at | timestamptz | `now()` | 가입 시각 |

> ⚠️ **카카오 알림 토큰(`kakao_message_token`)은 이 표에 두지 않고 따로 `user_secrets` 표에 둡니다.**
> PRD 데이터 모델은 User 표에 적어 두었지만, RLS는 "줄" 단위로만 막을 수 있어서 같은 줄에 있으면 본인 화면으로 토큰이 내려갈 수 있습니다. 비밀 값만 따로 떼어 **화면(브라우저)에서는 아예 읽을 수 없는 표**에 둡니다. 화면 쪽 타입도 같은 구조로 나눠 두었습니다(`types/domain.ts`의 `User`와 `UserSecret`).
>
> | `user_secrets` 칸 | DB 타입 | 설명 |
> |---|---|---|
> | user_id | uuid → users.id, 기본 키 | |
> | kakao_message_token | text | 서버(Edge Function·Route Handler)만 읽음. RLS 정책 없음 = 화면 접근 불가 |

### 2.2 `villages` — 마을

| 칸 | DB 타입 | 기본값 / 규칙 | 설명 |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | |
| name | text | 비울 수 없음, 글자 수 제한은 Task 005에서 정함 | 모임 이름 |
| kind | text | `'friends'` 또는 `'couple'`만 (check), **만든 뒤 변경 불가** | 마을 종류 (D-03) |
| invite_code | text | 유일, 비울 수 없음 | 초대 링크 값. 추측하기 어려운 무작위 글자 |
| created_by | uuid | → users.id | 만든 사람 |
| max_decor_level | int | `0`, 0~10 (check) | **지금까지 가장 높았던** 장식 단계. 알림 중복 방지용만 (D-10) |
| star_attached_at | timestamptz | 비워도 됨 | **처음** 100%에 도달한 시각 (성공 지표용) |
| photo_save_count | int | `0`, 0 이상 | 인증샷 저장 횟수 |
| created_at | timestamptz | `now()` | |

> **지금 장식 단계(decor_level) 칸은 없습니다.** 주민 수와 편지 수로 그때그때 계산합니다(4장). 저장해 두면 친구가 들어오거나 편지가 삭제될 때마다 고쳐야 하고, 고치는 것을 깜빡하면 화면과 실제가 어긋나기 때문입니다.

### 2.3 `residents` — 주민 (마을별 내 집)

| 칸 | DB 타입 | 기본값 / 규칙 | 설명 |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | |
| village_id | uuid | → villages.id (마을이 지워지면 함께 지움) | |
| user_id | uuid | → users.id | |
| character_parts | jsonb | 비워도 됨 | 6부위 꾸미기 값 `{hair, top, bottom, hat, scarf, gloves}`. **마을마다 따로** (D-05) |
| joined_at | timestamptz | `now()` | 입주 시각 = 집이 생긴 시각 |

- 유일: `(village_id, user_id)` — 같은 사람이 같은 마을에 두 번 입주하지 않음 (초대 링크를 다시 눌러도 집이 늘지 않음)

### 2.4 `letters` — 편지

| 칸 | DB 타입 | 기본값 / 규칙 | 설명 |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | |
| village_id | uuid | → villages.id | |
| sender_id | uuid | → users.id, 비울 수 없음 | 보낸 사람 (그 마을 주민만) |
| recipient_id | uuid | → users.id | 받는 사람 (그 마을 주민만) |
| content | text | 비울 수 없음, 글자 수 제한은 D-13 (임시 500자) | 내용 |
| unlock_at | timestamptz | 12.25 0시 | 잠금 풀리는 시각 |
| edited_at | timestamptz | 비워도 됨 | 마지막 수정 |
| deleted_at | timestamptz | 비워도 됨 | 삭제 = 숨김 처리 |
| opened_at | timestamptz | 비워도 됨 | 받는 사람이 처음 연 시각 |
| created_at | timestamptz | `now()` | |

- check: `sender_id <> recipient_id` — 자기 자신에게 쓰기 금지 (가정 2)
- **부분 유일 인덱스**: `(village_id, sender_id, recipient_id) where deleted_at is null` — 삭제되지 않은 편지는 한 사람에게 한 통만 (가정 2). 삭제한 뒤에는 다시 쓸 수 있습니다.
- 12.25 이후에는 쓰기·수정·삭제 금지 (PRD 미정 10 확정) → RLS 쓰기 정책에서 `now() < unlock_at` 검사

### 2.5 `couple_answers` — 커플 마을 질문지 답

| 칸 | DB 타입 | 기본값 / 규칙 | 설명 |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | |
| village_id | uuid | → villages.id (`kind = 'couple'`인 마을만, 트리거로 검사) | |
| author_id | uuid | → users.id | 답한 사람 |
| question_no | int | 1~4 (check) | 몇 번째 질문 |
| content | text | 비울 수 없음 | 답 내용 |
| unlock_at | timestamptz | 12.25 0시 | 상대가 읽을 수 있는 시각 (Letter와 같은 규칙) |
| created_at | timestamptz | `now()` | |

- 유일: `(village_id, author_id, question_no)`
- PRD 표에는 `unlock_at`이 없지만, 편지와 같은 RLS 규칙을 쓰기 쉽도록 넣었습니다.

### 2.6 `notification_logs` — 알림 발송 기록

| 칸 | DB 타입 | 기본값 / 규칙 | 설명 |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | |
| user_id | uuid | → users.id | 받는 사람 |
| village_id | uuid | → villages.id | |
| kind | text | `'new_ornament'` 또는 `'unlock'`만 | 알림 종류 |
| level | int | 비워도 됨 (new_ornament일 때 몇 단계 알림인지) | 같은 알림 두 번 방지 |
| sent_at | timestamptz | `now()` | |

- 유일: `(user_id, village_id, kind, level)` — 같은 알림을 두 번 보내지 않음
- 화면에서는 읽기·쓰기 모두 불가 (서버만 사용)

---

## 3. 데이터베이스가 직접 지키는 규칙 (제약·트리거)

| 규칙 | 방법 | 근거 |
|---|---|---|
| 커플 마을은 **2명까지만** 입주 | `residents`에 줄을 넣기 전 트리거가 주민 수를 세어 2명이면 거부 | PRD F009 [확정 11.24] |
| 마을 종류는 만든 뒤 변경 불가 | `villages` 수정 트리거에서 `kind`가 바뀌면 거부 | D-03 (가정 27) |
| 편지는 같은 마을 주민끼리만 | `letters`에 넣기 전 트리거가 보낸·받는 사람 모두 그 마을 `residents`에 있는지 검사 | PRD Letter 규칙 |
| 질문지 답은 커플 마을에서만 | `couple_answers`에 넣기 전 트리거가 `villages.kind = 'couple'` 검사 | F009 |
| 마을을 만들면 만든 사람이 첫 주민 | 마을 만들기 DB 함수 하나에서 `villages` + `residents`를 함께 저장 | F011, F013 |

> 💡 화면 코드에서도 같은 검사를 하지만, **데이터베이스에서 한 번 더** 막아 둡니다. 화면은 누군가 조작할 수 있지만 데이터베이스 규칙은 우회할 수 없습니다.

---

## 4. 진행률 계산은 어디서 하나요?

- **계산식**은 `lib/decor/progress.ts` 한 곳에만 있습니다(테스트 17개로 검증).
- 문제: RLS 때문에 나는 **남의 편지를 읽을 수 없으니** 편지 수도 셀 수 없습니다.
- 해결: 편지 **내용은 보여 주지 않고 숫자만** 돌려주는 DB 함수를 하나 만듭니다.

```
village_progress(village_id) → { resident_count, done_count }
  - 부르는 사람이 그 마을 주민인지 먼저 확인
  - 친구 마을: done_count = 삭제되지 않은 편지 수
  - 커플 마을: done_count = 질문지 답 수 + 삭제되지 않은 편지 수
```

- 화면은 이 숫자를 받아 `requiredCount()` → `computeDecorLevel()`로 지금 장식 단계를 계산합니다.
- 편지를 보낼 때마다 서버가 같은 계산을 해서 `shouldNotifyNewOrnament(지금 단계, max_decor_level)`가 참이면
  ① `max_decor_level`을 올리고 ② 처음 10단계면 `star_attached_at`을 기록하고 ③ 알림을 보냅니다 (Task 009·010).

---

## 5. 보안 규칙 (RLS) 초안

로그인한 사람 = `auth.uid()`. "주민"은 그 마을 `residents`에 줄이 있는 사람입니다.

| 표 | 읽기 | 쓰기 |
|---|---|---|
| users | 본인 + **같은 마을 주민**의 이름 | 본인 줄만 수정 |
| user_secrets | ❌ 화면에서 불가 (서버만) | ❌ 화면에서 불가 |
| villages | 그 마을 주민. 초대 링크 화면의 마을 이름은 `invite_code`로 이름만 돌려주는 DB 함수로 | 만들기는 DB 함수로만. 수정은 `photo_save_count` 같은 정해진 함수로만 |
| residents | 같은 마을 주민 | 입주는 초대 코드를 확인하는 DB 함수로만. `character_parts`는 본인 줄만 수정 |
| letters | **보낸 사람**은 언제나 / **받는 사람**은 `now() >= unlock_at`일 때만 / 그 밖의 사람은 불가 | 보낸 사람만, 12.25 전까지만 쓰기·수정·삭제(숨김) |
| couple_answers | 쓴 사람은 언제나 / 상대는 `now() >= unlock_at`일 때만 | 쓴 사람만, 12.25 전까지만 |
| notification_logs | ❌ 화면에서 불가 | ❌ 서버만 |

> - 받는 사람 화면의 "잠긴 편지 목록"(보낸 사람 이름만 보이고 내용은 잠김)은 내용을 빼고 목록만 돌려주는 DB 함수로 만듭니다.
> - "이미 넣었음" 표시는 보낸 사람 본인이 자기 편지를 읽을 수 있으므로 따로 함수가 필요 없습니다.
> - 이 초안은 Task 008에서 실제로 만들 때 Supabase 보안 점검(advisor)으로 한 번 더 확인합니다.

---

## 6. 아직 정하지 않은 것

| 내용 | 영향 | 관련 |
|---|---|---|
| 모임 이름 글자 수 제한 | `villages.name` check | Task 005 |
| 편지 글자 수 제한 (임시 500자) | `letters.content` check | D-13 |
| 캐릭터 부위별 모양 목록 | `character_parts` 안에 들어갈 값 | D-06 |
| 12.25 0시의 기준 시간대 (한국·일본은 같은 UTC+9) | `unlock_at` 기본값 | PRD 가정 10 |

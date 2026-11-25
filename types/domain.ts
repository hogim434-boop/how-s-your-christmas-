// 앱이 기억하는 정보(데이터)의 "모양"을 정해 둔 파일입니다.
// docs/prd.md "데이터 모델"의 표 6개를 TypeScript 타입으로 옮겼습니다.
//
// 💡 타입이란? "마을 정보에는 이름(글자)과 장식 단계(숫자)가 있다"처럼
//    정보의 모양을 미리 적어 두는 것입니다. 모양이 틀리면 코드를 실행하기 전에 빨간 줄로 알려 줍니다.
//
// 표기 규칙
// - 칸 이름은 데이터베이스(Supabase)와 똑같이 snake_case(밑줄)로 씁니다.
// - 날짜·시간은 "2026-12-25T00:00:00+09:00" 같은 글자(ISO 형식)로 다룹니다.
// - "아직 없음"은 null 로 표시합니다. (예: 아직 열어 보지 않은 편지의 opened_at)
// - 실제 데이터베이스를 만드는 Task 008에서 Supabase가 자동으로 만들어 주는 타입으로 바꿀 수 있습니다.

/** 로그인 수단 */
export type AuthProvider = "line" | "kakao";

/**
 * 마을 종류. 마을을 만들 때 고르고, 만든 뒤에는 바꿀 수 없습니다. [확정 11.25] (PRD 가정 27)
 * - friends: 친구 마을 (정원 없음, 써야 할 편지 n(n-1)통)
 * - couple: 커플 마을 (정원 2명, 질문지 8개 + 편지 2통 = 10개)
 */
export type VillageKind = "friends" | "couple";

/** 알림 종류: 새 장식이 달림 / 12.25 편지 잠금 해제 */
export type NotificationKind = "new_ornament" | "unlock";

/**
 * 캐릭터 꾸미기 값: 부위 6가지마다 고른 모양의 이름(키). (F016)
 * 부위별 모양 목록은 아직 정해지지 않아(로드맵 D-06) 일단 글자로 둡니다.
 */
export type CharacterParts = {
  hair: string;
  top: string;
  bottom: string;
  hat: string;
  scarf: string;
  gloves: string;
};

/** 사용자 */
export type User = {
  id: string;
  auth_provider: AuthProvider;
  /** LINE·카카오에서 받은 계정 식별값 */
  provider_user_id: string;
  /** 편지에 보이는 이름 (로그인 닉네임 그대로) */
  name: string;
  /** LINE 알림을 보낼 때 쓰는 값 (LINE 사용자만) */
  line_notify_id: string | null;
  created_at: string;
};

/**
 * 사용자의 비밀 값. ⚠️ 서버에서만 읽고 화면(브라우저)으로는 절대 보내지 않습니다.
 * 같은 줄에 두면 본인 화면으로 내려갈 수 있어서 users 표와 따로 둡니다. (docs/db-design.md 2.1)
 */
export type UserSecret = {
  user_id: string;
  /** 카카오톡 알림을 보낼 때 쓰는 값 (메시지 받기에 동의한 카카오 사용자만) */
  kakao_message_token: string | null;
};

/** 마을 */
export type Village = {
  id: string;
  /** 모임 이름 */
  name: string;
  kind: VillageKind;
  /** 초대 링크에 쓰는 값 */
  invite_code: string;
  /** 만든 사람 (User.id) */
  created_by: string;
  /**
   * 지금까지 가장 높이 올라갔던 장식 단계 (0~10).
   * ⚠️ 화면의 장식은 이 값이 아니라 "지금 진행률"로 계산합니다. [확정 11.25]
   * 이 값은 "새로운 장식이 달렸어요" 알림을 같은 단계로 두 번 보내지 않기 위해서만 씁니다.
   */
  max_decor_level: number;
  /** 처음 100%를 달성한 시각 (아직이면 null). 나중에 진행률이 내려가도 지우지 않음 */
  star_attached_at: string | null;
  /** 인증샷 저장을 누른 횟수 */
  photo_save_count: number;
  created_at: string;
};

/** 주민 (마을별 내 집) */
export type Resident = {
  id: string;
  village_id: string;
  user_id: string;
  /** 캐릭터 꾸미기 값. 마을마다 따로 저장합니다 [확정 11.25]. 아직 꾸미지 않았으면 null */
  character_parts: CharacterParts | null;
  /** 입주한 시각 (= 집이 생긴 시각) */
  joined_at: string;
};

/** 편지 */
export type Letter = {
  id: string;
  village_id: string;
  /** 보낸 사람 (이 마을 주민만) */
  sender_id: string;
  /** 받는 사람 */
  recipient_id: string;
  /** 편지 내용 (보낸 사람·받은 사람만 볼 수 있고, 잠금 전에는 받는 사람도 못 읽음) */
  content: string;
  /** 편지지 종류 (lib/letters/papers.ts의 이름. 받는 사람도 같은 편지지로 봄) [추가 11.26] */
  paper: string;
  /** 잠금이 풀리는 시각 (12.25) */
  unlock_at: string;
  edited_at: string | null;
  /** 삭제한 시각. 삭제하면 지우지 않고 숨김 처리합니다 */
  deleted_at: string | null;
  /** 받는 사람이 처음 연 시각 */
  opened_at: string | null;
  created_at: string;
};

/** 커플 마을의 질문지 답 */
export type CoupleAnswer = {
  id: string;
  village_id: string;
  /** 답한 사람 */
  author_id: string;
  /** 몇 번째 질문인지 (1~4) */
  question_no: 1 | 2 | 3 | 4;
  /** 답 내용 (12.25 전에는 상대가 읽을 수 없음) */
  content: string;
  /** 상대가 읽을 수 있게 되는 시각 (12.25, 편지와 같은 규칙) */
  unlock_at: string;
  created_at: string;
};

/** 알림 발송 기록 (같은 알림을 두 번 보내지 않기 위함) */
export type NotificationLog = {
  id: string;
  user_id: string;
  village_id: string;
  kind: NotificationKind;
  /** 새 장식 알림이면 몇 단계 알림인지 (12.25 알림이면 null) */
  level: number | null;
  sent_at: string;
};

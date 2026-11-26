// "로그인 전후에 어느 화면으로 보낼지"를 정하는 규칙 모음입니다. (로드맵 Task 007)
// 계산만 하는 순수 함수라서 서버·브라우저 어디서나 쓸 수 있고, 테스트(next.test.ts)로 확인합니다.
//
// 💡 next란? 로그인하지 않은 사람이 마을 주소로 바로 들어오면 로그인 화면으로 보내는데,
//    그때 "원래 가려던 주소"를 next라는 이름으로 기억해 두었다가 로그인 뒤 그곳으로 돌려보냅니다.

/** 로그인 실패 종류 (로그인 화면에 ?error=... 로 전달) */
export const AUTH_ERRORS = ["cancelled", "failed", "state_mismatch", "config"] as const;
export type AuthError = (typeof AUTH_ERRORS)[number];

/** 안내 종류 (?notice=... 로 전달) */
export const NOTICES = ["not_resident"] as const;
export type Notice = (typeof NOTICES)[number];

/** 주소로 받은 값이 우리가 아는 실패 종류면 그 값을, 아니면 undefined */
export function parseAuthError(value: unknown): AuthError | undefined {
  return AUTH_ERRORS.find((code) => code === value);
}

/** 주소로 받은 값이 우리가 아는 안내 종류면 그 값을, 아니면 undefined */
export function parseNotice(value: unknown): Notice | undefined {
  return NOTICES.find((code) => code === value);
}

/** 가짜 데이터로 그리는 연습용 마을 주소. 개발 중에는 로그인 없이 열어 둡니다 */
export const DEMO_VILLAGE_ID = "demo";

/**
 * 개발용 기능(연습용 마을, 주소의 ?dev 장식 단계 슬라이더)을 쓸 수 있는지.
 * 내 컴퓨터에서 `npm run dev`로 켰을 때만 true이고, 배포된 서비스(운영)에서는 false입니다.
 * (Task 010: 운영에서는 아무나 가짜 마을을 열거나 장식을 미리 보지 못하게 닫습니다)
 */
export function devToolsEnabled(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === "development";
}

/** 마지막으로 들어간 마을을 기억하는 쿠키 이름 (PRD 가정 13) */
export const LAST_VILLAGE_COOKIE = "hyc_last_village";

/** 주소가 마을 화면이면 그 마을 번호를, 아니면(연습용 마을 포함) null */
export function villageIdFromPath(pathname: string): string | null {
  const match = /^\/village\/([^/]+)/.exec(pathname);
  return match && match[1] !== DEMO_VILLAGE_ID ? match[1] : null;
}

/** next로 받을 수 있는 가장 긴 길이 */
const MAX_NEXT_LENGTH = 300;

/**
 * 로그인 뒤 돌아갈 주소(next)가 "우리 앱 안의 주소"인지 확인합니다. 안전하면 그 주소를, 아니면 null.
 *
 * 💡 왜 확인하나요? 나쁜 사람이 `?next=https://가짜사이트` 같은 링크를 퍼뜨리면,
 *    우리 앱에서 로그인한 직후 가짜 사이트로 넘어가 속을 수 있습니다(오픈 리다이렉트).
 *    그래서 "/"로 시작하는 우리 앱 안의 주소만 받습니다.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 2 || value.length > MAX_NEXT_LENGTH) return null;
  // "/"로 시작해야 하고, "//"나 "/\"로 시작하면 브라우저가 다른 사이트 주소로 해석할 수 있어 막습니다
  if (value[0] !== "/" || value[1] === "/" || value[1] === "\\") return null;
  // 역슬래시, 줄바꿈 같은 보이지 않는 글자가 섞인 주소도 받지 않습니다
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  // 로그인 처리용 주소로 되돌려 보내면 같은 자리를 맴돌 수 있습니다
  if (value === "/auth" || value.startsWith("/auth/") || value.startsWith("/auth?")) return null;
  return value;
}

/** 초대 코드로 쓸 수 있는 글자인지 확인합니다 (영문·숫자·-·_ 1~64자). 아니면 null */
export function safeInviteCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}

/** 로그인해야만 볼 수 있는 주소인지: 마을 만들기, 마을 화면 (연습용 마을은 제외) */
export function isProtectedPath(pathname: string): boolean {
  if (pathname === "/villages/new" || pathname.startsWith("/villages/new/")) return true;
  return villageIdFromPath(pathname) !== null;
}

/** 로그인 화면 주소를 만듭니다. 돌아갈 주소·초대 코드·안내를 ? 뒤에 붙입니다 */
export function loginUrl(options: { next?: string | null; invite?: string | null; error?: AuthError; notice?: Notice } = {}): string {
  const params = new URLSearchParams();
  const next = safeNextPath(options.next);
  const invite = safeInviteCode(options.invite);
  if (next) params.set("next", next);
  if (invite) params.set("invite", invite);
  if (options.error) params.set("error", options.error);
  if (options.notice) params.set("notice", options.notice);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

/**
 * 로그인에 성공한 사람을 어느 화면으로 보낼지 정합니다. (PRD "로그인 화면 → 다음 이동")
 *  1) 초대 링크로 왔으면 → 입주 처리 주소 (/invite/코드/join: 그 마을 주민이 된 뒤 마을로 보내 줌)
 *  2) 원래 가려던 주소(next)가 있으면 → 그 주소
 *  3) 속한 마을이 있으면 → 마지막으로 들어간 마을 (기억이 없거나 이제 주민이 아니면 가장 최근에 입주한 마을)
 *  4) 속한 마을이 없으면 → 마을 만들기
 */
export function resolveAfterLogin(input: {
  next?: string | null;
  inviteCode?: string | null;
  /** 내가 속한 마을 번호들. 가장 최근에 입주한 마을이 맨 앞 */
  villageIds: string[];
  /** 마지막으로 들어간 마을 번호 (브라우저 쿠키에 기억해 둔 값) */
  lastVillageId?: string | null;
}): string {
  const invite = safeInviteCode(input.inviteCode);
  // 입주 처리 주소로 바로 보냅니다 → 로그인이 끝나면 더 누를 것 없이 그 마을 주민이 됩니다 (Task 008)
  if (invite) return `/invite/${invite}/join`;

  const next = safeNextPath(input.next);
  if (next) return next;

  if (input.villageIds.length > 0) {
    const last = input.lastVillageId && input.villageIds.includes(input.lastVillageId) ? input.lastVillageId : input.villageIds[0];
    return `/village/${last}`;
  }
  return "/villages/new";
}

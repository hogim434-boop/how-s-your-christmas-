// 카카오 로그인이 끝난 뒤 Supabase가 알려 주는 사용자 정보에서
// "카카오 사용자 번호"와 "닉네임"을 꺼내는 순수 함수입니다. (로드맵 Task 007)
//
// 💡 Supabase는 로그인 수단이 준 정보를 identities(연결된 로그인 수단 목록)와 user_metadata(덧붙은 정보)에 담아 줍니다.
//    칸 이름이 수단마다 조금씩 달라서, 가능한 이름을 순서대로 찾아봅니다.

type Bag = Record<string, unknown> | null | undefined;

export type OAuthUserLike = {
  user_metadata?: Bag;
  identities?: { provider?: string; id?: string; identity_data?: Bag }[] | null;
};

/** 닉네임이 들어 있을 수 있는 칸 이름 (앞에 있을수록 먼저 씁니다) */
const NAME_KEYS = ["name", "nickname", "full_name", "user_name", "preferred_username"];
/** 카카오 사용자 번호가 들어 있을 수 있는 칸 이름 */
const ID_KEYS = ["sub", "provider_id"];

function pick(bag: Bag, keys: string[]): string | null {
  for (const key of keys) {
    const value = bag?.[key];
    if (typeof value === "string" && value.trim() !== "") return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

/** 카카오 사용자 번호와 닉네임. 카카오로 로그인한 계정이 아니거나 번호를 찾지 못하면 null */
export function kakaoProfile(user: OAuthUserLike): { providerUserId: string; name: string | null } | null {
  const identity = user.identities?.find((item) => item.provider === "kakao");
  if (!identity) return null;
  const providerUserId = pick(identity.identity_data, ID_KEYS) ?? pick(user.user_metadata, ID_KEYS) ?? identity.id ?? null;
  if (!providerUserId) return null;
  const name = pick(identity.identity_data, NAME_KEYS) ?? pick(user.user_metadata, NAME_KEYS);
  return { providerUserId, name };
}

// 🔒 처음 로그인한 사람의 "사용자 줄"(users 표)을 만드는 서버 전용 함수입니다. (로드맵 Task 007)
//
// 💡 왜 서버에서 만드나요?
//    users 표는 화면에서 줄을 만들 수 없게 막아 두었습니다 (남의 이름으로 줄을 만드는 일을 막기 위해).
//    그래서 로그인 확인이 끝난 서버 코드가 비밀 키로 대신 만들어 줍니다.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthProvider } from "@/types/domain";
import { normalizeName } from "./name";

export type EnsureUserInput = {
  /** Supabase 로그인 계정 번호 (auth.users의 id) */
  id: string;
  /** 로그인 수단 */
  provider: AuthProvider;
  /** 그 수단(LINE·카카오)에서의 사용자 번호 */
  providerUserId: string;
  /** 로그인 닉네임 (다듬어서 저장합니다) */
  name: unknown;
};

/**
 * 사용자 줄이 없으면 만들고, 이미 있으면 그대로 둡니다.
 * - 이름은 "처음 만들 때만" 넣습니다. 다시 로그인해도 덮어쓰지 않습니다 (나중에 이름 고치기가 생겨도 안전하도록)
 * - 실패하면 오류를 던집니다 (부른 쪽에서 로그인 실패 안내로 처리)
 */
export async function ensureUser(input: EnsureUserInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("users").upsert(
    {
      id: input.id,
      auth_provider: input.provider,
      provider_user_id: input.providerUserId,
      name: normalizeName(input.name),
    },
    // onConflict: 같은 id가 이미 있으면 / ignoreDuplicates: 아무것도 바꾸지 않고 넘어갑니다
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`사용자 줄을 만들지 못했습니다: ${error.message}`);
}

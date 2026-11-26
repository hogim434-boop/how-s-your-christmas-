// Supabase에 연결할 때 쓰는 주소와 공개 키를 읽는 곳입니다.
// 💡 NEXT_PUBLIC_ 으로 시작하는 값은 브라우저에 보여도 되는 값입니다 (.env.local 참고).
//    보안은 이 키가 아니라 데이터베이스의 보안 규칙(RLS)이 지킵니다.
// ⚠️ process.env.NEXT_PUBLIC_... 는 꼭 이렇게 "전체 이름"으로 적어야 합니다.
//    Next.js가 빌드할 때 이 글자를 찾아 실제 값으로 바꿔 넣기 때문에, 이름을 변수로 조립하면 브라우저에서 비어 있게 됩니다.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Supabase 주소와 공개 키. 값이 없으면 무엇을 해야 하는지 알려 주는 오류를 냅니다 */
export function supabaseEnv(): { url: string; publishableKey: string } {
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase 설정이 없습니다. .env.local 파일에 NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 를 넣고 서버를 다시 켜 주세요. (Vercel에 배포한 경우: Project Settings → Environment Variables에 넣고 다시 배포)",
    );
  }
  return { url, publishableKey };
}

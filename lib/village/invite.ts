// 초대 링크를 만들고 복사하는 도우미입니다. (F012)
// 마을 화면과 마을 만들기 화면이 함께 씁니다.

/** 초대 링크 주소를 만듭니다. 예: inviteUrl("https://example.com", "abc") → "https://example.com/invite/abc" */
export function inviteUrl(origin: string, code: string): string {
  return `${origin}/invite/${encodeURIComponent(code)}`;
}

/**
 * 글자를 클립보드(복사해 둔 것을 잠시 담아 두는 곳)에 복사합니다.
 * 성공하면 true, 브라우저가 막으면(권한·http 주소 등) false를 돌려줍니다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

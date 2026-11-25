// 브라우저의 작은 저장 공간(localStorage)을 "안전하게" 읽고 쓰는 도우미입니다.
// 💡 localStorage: 브라우저 안에 글자를 저장해 두는 곳. 새로고침해도 남아 있습니다.
// ⚠️ 개인 정보 보호 모드에서는 저장이 막힐 수 있고, 서버에서는 window 자체가 없습니다.
//    그런 경우에도 앱이 멈추지 않도록 try/catch로 감싸서 "없음(null)"으로 돌려줍니다.

/** 저장된 글자를 읽습니다. 없거나 읽을 수 없으면 null */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 글자를 저장합니다. 저장이 막혀 있으면 조용히 넘어갑니다(이번 화면에서만 적용됨) */
export function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장이 막혀 있으면 이번 화면에서만 적용됩니다
  }
}

/** 저장된 JSON을 읽습니다. 없거나 깨져 있으면 null */
export function readStorageJson(key: string): unknown {
  const raw = readStorage(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 저장된 값을 지웁니다. 막혀 있으면 조용히 넘어갑니다 */
export function removeStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 지울 수 없으면 그대로 둡니다
  }
}

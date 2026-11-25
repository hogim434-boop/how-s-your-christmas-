// 화면에 보이는 문구를 일본어·한국어로 한곳에 모아 두는 "문구 사전"입니다.
// 화면 코드에는 글자를 직접 쓰지 않고, 여기서 꺼내 씁니다.
// 그래야 문구를 고칠 때 이 파일 하나만 보면 되고, 두 언어가 어긋나지 않습니다.

/** 지원하는 언어: ja(일본어), ko(한국어) */
export type Locale = "ja" | "ko";

/** 문구 사전의 모양(키 목록). 두 언어 모두 이 모양을 똑같이 지켜야 합니다. */
type Messages = {
  /** 서비스 이름 (언어와 상관없이 같음) */
  appName: string;
  /** 첫 화면 아래쪽 안내 문구 */
  tagline: string;
};

// satisfies: "두 언어 모두 Messages 모양을 빠짐없이 지켰는지" 타입스크립트가 검사해 줍니다.
// 한쪽에만 문구를 추가하면 빨간 줄(오류)이 떠서 실수를 막아 줍니다.
const messages = {
  ja: {
    appName: "How's your Christmas",
    tagline: "友だちと手紙を送り合って、村のツリーを飾ろう",
  },
  ko: {
    appName: "How's your Christmas",
    tagline: "친구와 편지를 주고받으며 마을 트리를 꾸며요",
  },
} satisfies Record<Locale, Messages>;

/**
 * 기본 언어. 언어를 고르는 방식은 아직 정해지지 않았습니다(로드맵 D-17).
 * 그때까지는 PRD 가정 22("한국어가 아니면 주 타깃인 일본어")에 따라 일본어로 둡니다.
 */
export const DEFAULT_LOCALE: Locale = "ja";

/** 원하는 언어의 문구 묶음을 꺼냅니다. 예: getMessages("ko").tagline */
export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return messages[locale];
}

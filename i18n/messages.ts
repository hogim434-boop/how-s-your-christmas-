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
  /** 겹쳐 뜨는 창의 닫기 버튼 (화면 읽기 도구용 이름) */
  close: string;
  /** 내 집 위에 뜨는 이름표 */
  myHouse: string;
  /** 3D 마을을 불러오는 동안 보이는 문구 */
  villageLoading: string;
  /** 우체통 접근성 이름 (화면 읽기 도구용). {name} 자리에 주민 이름이 들어갑니다 */
  mailboxLabel: string;
  /** 편지를 이미 보낸 우체통의 표시 이름 */
  mailboxSent: string;
  /** 내 우체통 가까이 갔을 때 뜨는 버튼 */
  openLetterboxPrompt: string;
  /** 크리스마스까지 남은 날 표시. {n} 자리에 숫자가 들어갑니다 (예: "D-30") */
  ddayLabel: string;
  /** 12.25 당일·이후 표시 */
  ddayDone: string;
  /** D-day 숫자 아래 작은 글자 */
  untilChristmas: string;
  /** 화면 읽기 도구용: 진행률 */
  progressAria: string;
  /** 걷기 안내 */
  tapHint: string;
  /** 트리 전체 보기 / 마을로 돌아가기 버튼 */
  treeView: string;
  /** 둥근 버튼 아래 작은 글자 (트리 보기 / 마을로) */
  treeShort: string;
  backShort: string;
  backToVillage: string;
  /** 아이콘 버튼 이름 */
  letterbox: string;
  customize: string;
  invite: string;
  menu: string;
  /** 친구에게 쓰는 편지 창 제목. {name} 자리에 이름 */
  writeLetterTitle: string;
  /** 편지 쓰기 창 임시 안내 */
  writeLetterPlaceholder: string;
  /** 편지함 창 임시 안내 */
  letterboxPlaceholder: string;
  /** 꾸미기 창 임시 안내 */
  customizePlaceholder: string;
  /** 초대 링크 복사 결과 안내 */
  inviteCopied: string;
  inviteCopyFailed: string;
  /** 주민 1명일 때 보이는 초대 카드 */
  inviteCardTitle: string;
  inviteCopyButton: string;
  /** 메뉴 창 */
  logout: string;
  /** 메뉴: 하늘(시간대) 고르기와 세 가지 이름 */
  skyMode: string;
  skyDay: string;
  skyDusk: string;
  skyNight: string;
  /** 메뉴: 언어 고르기 */
  language: string;
  logoutPlaceholder: string;
  appComingSoon: string;
  /** 개발용 단계 슬라이더 이름 (?dev일 때만 보임) */
  devLevel: string;
};

// satisfies: "두 언어 모두 Messages 모양을 빠짐없이 지켰는지" 타입스크립트가 검사해 줍니다.
// 한쪽에만 문구를 추가하면 빨간 줄(오류)이 떠서 실수를 막아 줍니다.
const messages = {
  ja: {
    appName: "How's your Christmas",
    tagline: "友だちと手紙を送り合って、村のツリーを飾ろう",
    close: "閉じる",
    myHouse: "わたしの家",
    villageLoading: "村を準備しています…",
    mailboxLabel: "{name}さんのポスト",
    mailboxSent: "送信済み",
    openLetterboxPrompt: "手紙箱を見る",
    ddayLabel: "D-{n}",
    ddayDone: "D-Day",
    untilChristmas: "クリスマスまで",
    progressAria: "進行度",
    tapHint: "地面をタップすると歩くよ",
    treeView: "ツリー全体を見る",
    treeShort: "ツリー",
    backShort: "村へ",
    backToVillage: "村にもどる",
    letterbox: "手紙箱",
    customize: "着せ替え",
    invite: "招待",
    menu: "メニュー",
    writeLetterTitle: "{name}さんへ手紙を書く",
    writeLetterPlaceholder: "手紙の書き方フォームは次のタスク(Task 005)で作ります。",
    letterboxPlaceholder: "手紙箱の画面は次のタスク(Task 005)で作ります。",
    customizePlaceholder: "キャラクターの着せ替えは次のタスク(Task 005)で作ります。",
    inviteCopied: "招待リンクをコピーしました",
    inviteCopyFailed: "コピーできませんでした。リンクを長押ししてコピーしてね",
    inviteCardTitle: "友だちを招待しよう",
    inviteCopyButton: "リンクをコピー",
    logout: "ログアウト",
    skyMode: "空",
    skyDay: "朝",
    skyDusk: "夕焼け",
    skyNight: "夜",
    language: "言語",
    logoutPlaceholder: "ログアウトは後で作ります(仮)",
    appComingSoon: "アプリは近日公開予定です",
    devLevel: "飾りの段階",
  },
  ko: {
    appName: "How's your Christmas",
    tagline: "친구와 편지를 주고받으며 마을 트리를 꾸며요",
    close: "닫기",
    myHouse: "내 집",
    villageLoading: "마을을 준비하고 있어요…",
    mailboxLabel: "{name}님의 우체통",
    mailboxSent: "보냄",
    openLetterboxPrompt: "편지함 보기",
    ddayLabel: "D-{n}",
    ddayDone: "D-Day",
    untilChristmas: "크리스마스까지",
    progressAria: "진행률",
    tapHint: "땅을 누르면 걸어가요",
    treeView: "트리 전체 보기",
    treeShort: "트리",
    backShort: "마을로",
    backToVillage: "마을로 돌아가기",
    letterbox: "편지함",
    customize: "꾸미기",
    invite: "초대",
    menu: "메뉴",
    writeLetterTitle: "{name}님께 편지 쓰기",
    writeLetterPlaceholder: "편지 쓰기 양식은 다음 작업(Task 005)에서 만들어요.",
    letterboxPlaceholder: "편지함 화면은 다음 작업(Task 005)에서 만들어요.",
    customizePlaceholder: "캐릭터 꾸미기는 다음 작업(Task 005)에서 만들어요.",
    inviteCopied: "초대 링크를 복사했어요",
    inviteCopyFailed: "복사하지 못했어요. 링크를 길게 눌러 복사해 주세요",
    inviteCardTitle: "친구를 초대해요",
    inviteCopyButton: "링크 복사",
    logout: "로그아웃",
    skyMode: "하늘",
    skyDay: "아침",
    skyDusk: "노을",
    skyNight: "밤",
    language: "언어",
    logoutPlaceholder: "로그아웃은 나중에 만들어요 (임시)",
    appComingSoon: "앱 출시 coming soon",
    devLevel: "장식 단계",
  },
} satisfies Record<Locale, Messages>;

/**
 * 기본 언어. 언어를 고르는 방식은 아직 정해지지 않았습니다(로드맵 D-17).
 * 그때까지는 PRD 가정 22("한국어가 아니면 주 타깃인 일본어")에 따라 일본어로 둡니다.
 */
export const DEFAULT_LOCALE: Locale = "ja";

/** 언어 고르기 버튼에 쓰는 이름 (각 언어를 그 언어로 표기) */
export const LOCALE_NAMES: Record<Locale, string> = { ja: "日本語", ko: "한국어" };

/** 원하는 언어의 문구 묶음을 꺼냅니다. 예: getMessages("ko").tagline */
export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return messages[locale];
}

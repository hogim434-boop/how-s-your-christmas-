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
  skyNight: string;
  /** 메뉴: 언어 고르기 */
  language: string;
  logoutPlaceholder: string;
  appComingSoon: string;
  /** 개발용 단계 슬라이더 이름 (?dev일 때만 보임) */
  devLevel: string;
  /** 편지 쓰기 창 (F004·F006). {name} 자리에 이름, {max} 자리에 글자 수 제한 */
  letterTo: string;
  letterFrom: string;
  letterInputPlaceholder: string;
  letterLockNote: string;
  letterSend: string;
  letterEdit: string;
  letterSent: string;
  letterEdited: string;
  letterTooLong: string;
  /** 12.25부터 편지 쓰기가 끝났을 때 */
  lettersClosed: string;
  /** 편지지 고르기 (이름은 화면 읽기 도구용) */
  letterPaper: string;
  paperPlain: string;
  paperSnow: string;
  paperTree: string;
  paperCandy: string;
  /** 임시 저장 */
  letterDraftRestored: string;
  letterDraftDiscard: string;
  letterDraftSaved: string;
  /** 보내는 중 연출 동안 화면 읽기 도구가 읽는 말 */
  letterSending: string;
  /** 편지함 창 (F005·F006). {n} 자리에 남은 날 */
  letterboxReceived: string;
  letterboxSent: string;
  letterLocked: string;
  letterLockedUntil: string;
  letterboxEmptyReceived: string;
  letterboxEmptySent: string;
  letterEditedMark: string;
  edit: string;
  letterDelete: string;
  letterDeleteConfirm: string;
  letterDeleted: string;
  cancel: string;
  /** 캐릭터 꾸미기 창 (F016): 부위 6가지 이름 */
  partHair: string;
  partTop: string;
  partBottom: string;
  partHat: string;
  partScarf: string;
  partGloves: string;
  partNone: string;
  customizeConfirm: string;
  customizeSaved: string;
  customizeComingSoon: string;
  /** 로그인 화면 (F010·F012) */
  loginWithLine: string;
  loginWithKakao: string;
  invitedTo: string;
  loginNotifyHint: string;
  /** 초대 링크 입구 */
  inviteLandingTitle: string;
  inviteEnter: string;
  /** 마을 만들기 화면 (F011·F012) */
  createVillageTitle: string;
  villageNameLabel: string;
  villageNamePlaceholder: string;
  villageNameTooLong: string;
  villageKindLabel: string;
  kindFriends: string;
  kindFriendsDesc: string;
  kindCouple: string;
  kindCoupleDesc: string;
  createVillageButton: string;
  villageCreated: string;
  inviteLinkLabel: string;
  goCustomize: string;
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
    inviteCopied: "招待リンクをコピーしました",
    inviteCopyFailed: "コピーできませんでした。リンクを長押ししてコピーしてね",
    inviteCardTitle: "友だちを招待しよう",
    inviteCopyButton: "リンクをコピー",
    logout: "ログアウト",
    skyMode: "空",
    skyDay: "朝",
    skyNight: "夜",
    language: "言語",
    logoutPlaceholder: "ログアウトは後で作ります(仮)",
    appComingSoon: "アプリは近日公開予定です",
    devLevel: "飾りの段階",
    letterTo: "{name}さんへ",
    letterFrom: "{name}より",
    letterInputPlaceholder: "伝えたい気持ちを書いてね",
    letterLockNote: "相手はクリスマス(12月25日)まで読めません",
    letterSend: "ポストに入れる",
    letterEdit: "書き直す",
    letterSent: "手紙をポストに入れました",
    letterEdited: "手紙を書き直しました",
    letterTooLong: "{max}文字以内で書いてね",
    lettersClosed: "手紙の受付は終了しました",
    letterPaper: "便せん",
    paperPlain: "クリーム",
    paperSnow: "雪",
    paperTree: "ツリー",
    paperCandy: "キャンディ",
    letterDraftRestored: "書きかけの手紙を開きました",
    letterDraftDiscard: "最初から",
    letterDraftSaved: "書きかけの手紙を保存しました",
    letterSending: "手紙をポストに入れています…",
    letterboxReceived: "もらった手紙",
    letterboxSent: "送った手紙",
    letterLocked: "ひみつの手紙",
    letterLockedUntil: "12月25日に開きます(あと{n}日)",
    letterboxEmptyReceived: "まだ手紙は届いていません",
    letterboxEmptySent: "まだ手紙を送っていません。友だちのポストに入れてみよう",
    letterEditedMark: "編集済み",
    edit: "編集",
    letterDelete: "削除",
    letterDeleteConfirm: "この手紙を削除しますか?",
    letterDeleted: "手紙を削除しました",
    cancel: "キャンセル",
    partHair: "髪",
    partTop: "トップス",
    partBottom: "ボトムス",
    partHat: "帽子",
    partScarf: "マフラー",
    partGloves: "手袋",
    partNone: "なし",
    customizeConfirm: "これにする",
    customizeSaved: "着せ替えを保存しました",
    customizeComingSoon: "見た目は準備中です。選んだ内容は保存されます",
    loginWithLine: "LINEではじめる",
    loginWithKakao: "カカオではじめる",
    invitedTo: "「{name}」に招待されました",
    loginNotifyHint: "ログインすると、新しい飾りや手紙のお知らせが届きます",
    inviteLandingTitle: "村への招待が届きました",
    inviteEnter: "この村に入る",
    createVillageTitle: "村をつくる",
    villageNameLabel: "集まりの名前",
    villageNamePlaceholder: "例:大学のなかま",
    villageNameTooLong: "{max}文字以内で入力してね",
    villageKindLabel: "村の種類",
    kindFriends: "友だちの村",
    kindFriendsDesc: "人数の制限なし。みんなで手紙を送り合います",
    kindCouple: "カップルの村",
    kindCoupleDesc: "ふたりだけの村。質問と手紙でツリーを飾ります",
    createVillageButton: "村をつくる",
    villageCreated: "村ができました!",
    inviteLinkLabel: "招待リンク",
    goCustomize: "キャラクターを着せ替える",
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
    inviteCopied: "초대 링크를 복사했어요",
    inviteCopyFailed: "복사하지 못했어요. 링크를 길게 눌러 복사해 주세요",
    inviteCardTitle: "친구를 초대해요",
    inviteCopyButton: "링크 복사",
    logout: "로그아웃",
    skyMode: "하늘",
    skyDay: "아침",
    skyNight: "밤",
    language: "언어",
    logoutPlaceholder: "로그아웃은 나중에 만들어요 (임시)",
    appComingSoon: "앱 출시 coming soon",
    devLevel: "장식 단계",
    letterTo: "{name}님께",
    letterFrom: "{name} 드림",
    letterInputPlaceholder: "전하고 싶은 마음을 적어 보세요",
    letterLockNote: "받는 사람은 크리스마스(12월 25일)까지 읽을 수 없어요",
    letterSend: "우체통에 넣기",
    letterEdit: "고치기",
    letterSent: "편지를 우체통에 넣었어요",
    letterEdited: "편지를 고쳤어요",
    letterTooLong: "{max}자 이내로 써 주세요",
    lettersClosed: "편지 보내기가 끝났어요",
    letterPaper: "편지지",
    paperPlain: "크림",
    paperSnow: "눈",
    paperTree: "트리",
    paperCandy: "사탕",
    letterDraftRestored: "쓰던 편지를 불러왔어요",
    letterDraftDiscard: "처음부터",
    letterDraftSaved: "쓰던 편지를 임시 저장했어요",
    letterSending: "편지를 우체통에 넣는 중…",
    letterboxReceived: "받은 편지",
    letterboxSent: "보낸 편지",
    letterLocked: "잠긴 편지",
    letterLockedUntil: "12월 25일에 열려요 (D-{n})",
    letterboxEmptyReceived: "아직 받은 편지가 없어요",
    letterboxEmptySent: "아직 보낸 편지가 없어요. 친구 우체통에 편지를 넣어 보세요",
    letterEditedMark: "수정됨",
    edit: "수정",
    letterDelete: "삭제",
    letterDeleteConfirm: "이 편지를 지울까요?",
    letterDeleted: "편지를 지웠어요",
    cancel: "취소",
    partHair: "머리카락",
    partTop: "상의",
    partBottom: "하의",
    partHat: "모자",
    partScarf: "목도리",
    partGloves: "장갑",
    partNone: "없음",
    customizeConfirm: "확인",
    customizeSaved: "꾸미기를 저장했어요",
    customizeComingSoon: "모양은 준비 중이에요. 고른 내용은 저장돼요",
    loginWithLine: "LINE으로 시작하기",
    loginWithKakao: "카카오로 시작하기",
    invitedTo: "\"{name}\"에 초대받았어요",
    loginNotifyHint: "로그인하면 새 장식과 편지 소식을 알림으로 받아요",
    inviteLandingTitle: "마을 초대장이 도착했어요",
    inviteEnter: "이 마을에 들어가기",
    createVillageTitle: "마을 만들기",
    villageNameLabel: "모임 이름",
    villageNamePlaceholder: "예: 대학 동기 모임",
    villageNameTooLong: "{max}자 이내로 입력해 주세요",
    villageKindLabel: "마을 종류",
    kindFriends: "친구 마을",
    kindFriendsDesc: "인원 제한 없이 서로 편지를 주고받아요",
    kindCouple: "커플 마을",
    kindCoupleDesc: "둘만의 마을. 질문과 편지로 트리를 꾸며요",
    createVillageButton: "마을 만들기",
    villageCreated: "마을이 만들어졌어요!",
    inviteLinkLabel: "초대 링크",
    goCustomize: "캐릭터 꾸미러 가기",
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

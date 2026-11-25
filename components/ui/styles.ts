// 여러 화면이 함께 쓰는 버튼 모양(Tailwind 클래스 묶음)입니다.
// 한곳에 모아 두면 모든 창의 버튼이 같은 크기·둥글기·눌림 느낌을 갖습니다.
// (11.26 사용자 요청: 화면을 더 세련되고 현대적으로)

/** 가장 중요한 버튼 (남색 바탕 + 흰 글자). 창마다 하나만 씁니다 */
export const PRIMARY_BUTTON =
  "flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#232b52] text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:bg-[#c9ccd8] disabled:text-white";

/** 덜 중요한 버튼 (옅은 회색 바탕 + 남색 글자) */
export const SECONDARY_BUTTON =
  "flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#f3f4f8] text-[15px] font-semibold text-[#232b52] transition active:scale-[0.98]";

/** 목록 줄 안의 작은 글자 버튼 (수정·삭제 같은 것). 누르는 영역은 44px을 지킵니다 */
export const TEXT_BUTTON =
  "flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition active:bg-black/5";

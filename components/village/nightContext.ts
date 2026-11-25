"use client";

// 지금 밤(불이 켜지는 시간)인지를 3D 장면 곳곳(전구 줄, 가로등, 땅 등)에 나눠 주는 통로(context)입니다.
// VillageScene이 값을 정하고, 아래 부품은 useNight()로 꺼내 씁니다.


import { createContext, useContext } from "react";

export const NightContext = createContext(false);

/** 지금 밤인지 */
export function useNight() {
  return useContext(NightContext);
}

/**
 * 밤에 전구 색을 몇 배로 밝힐지.
 * 1보다 밝은 색은 "빛 번짐(Bloom)" 효과가 알아보고 주변으로 은은하게 퍼뜨립니다 → 진짜 불빛처럼 보임
 */
export const NIGHT_GLOW = 2.6;

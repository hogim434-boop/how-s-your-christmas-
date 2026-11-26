"use client";

// 밤 모드의 "후처리": 다 그린 화면 위에 사진 필터처럼 한 번 더 입히는 효과입니다.
// 예전 시안(_archive/prototypes/island-3d/src/Effects.tsx)의 "미니어처 밤" 설정과 똑같습니다.
//
// - N8AO: 물체가 맞닿은 구석에 은은한 그림자를 넣어 입체감을 줍니다
//   (11.25 성능: halfRes = 절반 해상도로 계산. 계산량은 약 1/4, 보기엔 거의 같습니다)
//   (11.26 성능: 투명한 물체를 따로 두 번 더 그리는 기능을 껐습니다 → 아래 skipTransparentRedraw 설명)
// - Bloom(빛 번짐): 아주 밝은 곳(전구·가로등) 둘레로 빛이 퍼져 보이게 합니다
// - Vignette: 화면 가장자리를 어둑하게
// - ToneMapping(NEUTRAL): 밝기를 자연스럽게 정리
// - SMAA: 계단처럼 보이는 가장자리를 매끈하게
//
// ⚠️ 화면 전체를 한 번 더 처리하므로 휴대폰에 부담이 생깁니다. 그래서 아침에는 쓰지 않습니다.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { CopyPass, EffectPass, ToneMappingMode, type EffectComposer as EffectComposerImpl } from "postprocessing";

/**
 * N8AO가 "투명한 물체를 매 장면 두 번 더 그리는 일"을 끕니다. (11.26 성능)
 *
 * N8AO는 장면에 투명한 물체(눈송이·빛 번짐 그림·폭죽 등)가 하나라도 있으면,
 * 그 물체들에는 구석 그림자가 덧입혀지지 않게 하려고 매 장면마다
 *   ① 장면의 모든 물체를 네 번 훑고  ② 화면 전체를 두 번 더 칠하고  ③ 투명한 물체를 두 번 더 그립니다.
 * 우리 마을은 구석 그림자가 옅고 투명한 물체가 작아서, 이 기능을 꺼도 화면이 사실상 똑같습니다.
 * (휴대폰의 9배 크기 화면으로 잰 값: 한 장면 27ms → 24ms. 계산 장치를 6배 느리게 했을 때: 13.6ms → 9.7ms)
 *
 * 💡 ref에 함수를 주면, 그 부품이 만들어지는 순간 React가 이 함수를 불러 줍니다.
 */
function skipTransparentRedraw(pass: { autoDetectTransparency?: boolean; configuration: { transparencyAware: boolean } } | null) {
  if (!pass) return;
  // 자동 감지를 먼저 꺼야 합니다. 켜 두면 다음 장면에서 투명한 물체를 찾아 기능을 다시 켭니다
  pass.autoDetectTransparency = false;
  pass.configuration.transparencyAware = false;
}

/**
 * 맨 끝의 "화면 전체를 그대로 한 번 더 복사하는 단계"를 건너뜁니다. (11.26 성능)
 *
 * 화면 필터 라이브러리는 N8AO를 쓰면 맨 끝에 복사 단계(CopyPass)를 하나 덧붙입니다.
 * N8AO가 맨 마지막 단계일 때를 대비한 것인데, 우리는 그 뒤에 빛 번짐·가장자리 다듬기 단계가 있어서 필요 없습니다.
 * 그래서 복사 단계를 끄고, 바로 앞 단계가 화면에 직접 그리게 합니다.
 * (잰 값: 밤 한 장면 4~6% 절감. 화면은 일부 점의 색 값이 1/255 달라지는 정도라 눈으로 구분할 수 없습니다)
 *
 * 단계 목록은 라이브러리가 다시 만들 수 있어서 매 장면 확인합니다 (확인은 비교 몇 번뿐이라 부담이 없습니다).
 * 라이브러리가 나중에 복사 단계를 붙이지 않게 바뀌면, 아래 조건에 맞지 않아 아무 일도 하지 않습니다.
 */
function skipTrailingCopy(composer: EffectComposerImpl | null) {
  if (!composer) return;
  const passes = composer.passes;
  const last = passes[passes.length - 1];
  const before = passes[passes.length - 2];
  if (last instanceof CopyPass && last.enabled && before instanceof EffectPass) {
    last.enabled = false;
    before.renderToScreen = true;
  }
}

export function SkyEffects() {
  const composer = useRef<EffectComposerImpl>(null);
  // 화면 필터가 그리기 직전에 실행됩니다 (필터는 순서 1번, 이 함수는 0번이라 먼저)
  useFrame(() => skipTrailingCopy(composer.current));
  return (
    // stencilBuffer: 반투명한 집 뒤 우체통·캐릭터를 또렷하게 보여 주는 "도장 판"을 후처리에서도 유지
    <EffectComposer ref={composer} multisampling={0} stencilBuffer>
      <N8AO ref={skipTransparentRedraw} halfRes aoRadius={1.4} intensity={1.6} distanceFalloff={1} color="#0e1430" />
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.35} intensity={1.1} radius={0.7} />
      <Vignette offset={0.25} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  );
}

"use client";

// 노을·밤 모드의 "후처리": 다 그린 화면 위에 사진 필터처럼 한 번 더 입히는 효과입니다.
// 예전 시안(_archive/prototypes/island-3d/src/Effects.tsx)의 dusk / night 설정과 똑같습니다.
//
// - N8AO: 물체가 맞닿은 구석에 은은한 그림자를 넣어 입체감을 줍니다
// - Bloom(빛 번짐): 아주 밝은 곳(전구·가로등) 둘레로 빛이 퍼져 보이게 합니다
// - HueSaturation: 색을 살짝 더 진하게 (노을만)
// - Vignette: 화면 가장자리를 어둑하게
// - ToneMapping: 밝기를 자연스럽게 정리 (노을 AGX, 밤 NEUTRAL)
// - SMAA: 계단처럼 보이는 가장자리를 매끈하게
//
// ⚠️ 화면 전체를 한 번 더 처리하므로 휴대폰에 부담이 생깁니다. 그래서 아침에는 쓰지 않습니다.

import { Bloom, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export function SkyEffects({ mode }: { mode: "dusk" | "night" }) {
  if (mode === "dusk") {
    return (
      // stencilBuffer: 반투명한 집 뒤 우체통·캐릭터를 또렷하게 보여 주는 "도장 판"을 후처리에서도 유지
      <EffectComposer multisampling={0} stencilBuffer>
        <N8AO aoRadius={1.2} intensity={2} distanceFalloff={1} color="#1d1830" />
        <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.3} intensity={1.2} radius={0.75} />
        <HueSaturation saturation={0.08} />
        <Vignette offset={0.25} darkness={0.5} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <SMAA />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0} stencilBuffer>
      <N8AO aoRadius={1.4} intensity={1.6} distanceFalloff={1} color="#0e1430" />
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.35} intensity={1.1} radius={0.7} />
      <Vignette offset={0.25} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  );
}

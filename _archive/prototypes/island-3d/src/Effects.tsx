import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import type { StyleId } from './styles'

// 후처리: 다 그려진 화면에 사진 필터처럼 입히는 효과입니다.
// 그림체마다 다른 필터를 씁니다.

/** 그림체에 맞는 후처리 묶음 */
export function Effects({ style }: { style: StyleId }) {
  if (style === 'light') {
    // 빛: 밝은 것 주변이 크게 번지게 해서 어둠 속 불빛을 강조합니다
    return (
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.4} intensity={1.25} />
        <Vignette offset={0.2} darkness={0.7} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    )
  }
  if (style === 'real') {
    // 사실적: 실제 카메라 사진처럼. 구석 그림자로 무게감을 주고,
    // AgX 톤 매핑으로 눈처럼 아주 밝은 곳도 하얗게 날아가지 않고 결이 살아 있게 합니다
    return (
      <EffectComposer multisampling={0}>
        <N8AO aoRadius={1.2} intensity={2.4} distanceFalloff={1} color="#1c2433" />
        <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.3} intensity={0.35} />
        <BrightnessContrast brightness={0.02} contrast={0.06} />
        <Vignette offset={0.35} darkness={0.22} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <SMAA />
      </EffectComposer>
    )
  }
  if (style === 'dusk') {
    // 노을: 불빛이 부드럽게 번지고(Bloom), 화면 가장자리는 저녁처럼 어둑하게
    return (
      <EffectComposer multisampling={0}>
        <N8AO aoRadius={1.2} intensity={2} distanceFalloff={1} color="#1d1830" />
        <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.3} intensity={1.2} radius={0.75} />
        <HueSaturation saturation={0.08} />
        <Vignette offset={0.25} darkness={0.5} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <SMAA />
      </EffectComposer>
    )
  }
  if (style === 'night') {
    // 미니어처 밤: 미니어처의 구석 그림자는 그대로 두고, 전구·가로등 불빛이 은은하게 번지게(Bloom) 합니다
    return (
      <EffectComposer multisampling={0}>
        <N8AO aoRadius={1.4} intensity={1.6} distanceFalloff={1} color="#0e1430" />
        <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.35} intensity={1.1} radius={0.7} />
        <Vignette offset={0.25} darkness={0.55} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <SMAA />
      </EffectComposer>
    )
  }
  if (style === 'diorama') {
    return (
      <EffectComposer multisampling={0}>
        {/* 구석 그림자: 물체가 땅에 닿는 곳, 처마 아래, 벽 모서리처럼 빛이 잘 안 드는 곳을 살짝 어둡게 합니다.
            실제 모형을 찍은 사진 같은 깊이감이 여기서 나옵니다 */}
        {/* 그림자 색을 보라회색 대신 푸른 그늘색으로, 세기도 조금 약하게 해서 탁해지지 않게 합니다 */}
        <N8AO aoRadius={1.4} intensity={2.2} distanceFalloff={1} color="#5a6f9a" />
        {/* 색 보정: 색은 아주 살짝만 빼고(-0.05), 대비는 조금 올려서 또렷하고 화사하게 만듭니다 */}
        <HueSaturation saturation={-0.05} />
        <BrightnessContrast brightness={0.04} contrast={0.05} />
        {/* 화면 가장자리 어둡게 하는 효과도 약하게 */}
        <Vignette offset={0.3} darkness={0.18} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        {/* 계단처럼 깨져 보이는 가장자리를 매끄럽게 다듬습니다 */}
        <SMAA />
      </EffectComposer>
    )
  }
  return null
}

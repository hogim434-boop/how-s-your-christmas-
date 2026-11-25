import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { Bloom, EffectComposer, TiltShift2, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { Customizer } from './Customizer'
import { loadLook, saveLook } from './look'
import type { Look } from './look'
import { Player } from './Player'
import {
  ChristmasTree,
  Footprints,
  House,
  Island,
  Lamp,
  Mailbox,
  Pines,
  Sky,
  Snow,
  Snowman,
  TapPlane,
  TargetMarker,
} from './Scenery'
import { resolveTarget } from './world'
import type { SpotId } from './world'

/** 트리에 걸 수 있는 편지(장식)의 최대 개수 */
const MAX_LETTERS = 12

/** 편지를 달 때 나는 짧은 "딩동" 소리. 소리 파일 없이 브라우저가 직접 만들어 냅니다. */
export function playChime() {
  try {
    const ctx = new AudioContext()
    // 두 음(미, 솔#)을 살짝 시차를 두고 울립니다
    ;[659.25, 830.61].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = ctx.currentTime + i * 0.12
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.75)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {
    // 소리를 낼 수 없는 환경이면 조용히 넘어갑니다
  }
}

export default function App() {
  // 캐릭터가 걸어갈 목표 지점. 매 프레임 읽어야 해서 state 대신 ref 를 씁니다.
  const target = useRef(new THREE.Vector3(0, 0, 3.5))
  const playerPos = useRef(new THREE.Vector3(0, 0, 3.5)) // 캐릭터의 현재 위치
  const [marker, setMarker] = useState<THREE.Vector3 | null>(null)
  const [near, setNear] = useState<SpotId | null>(null) // 지금 가까이 있는 장소
  const [letters, setLetters] = useState(3) // 트리에 걸린 편지 수
  const [emote, setEmote] = useState(0) // 값이 바뀌면 캐릭터가 손을 흔듭니다
  const [toast, setToast] = useState('') // 잠깐 떴다 사라지는 안내 문구
  const [look, setLook] = useState<Look>(loadLook) // 캐릭터 겉모습 설정
  // 꾸미기 화면이 열려 있는지 (주소에 ?customize=1 이 있으면 처음부터 열어 둡니다)
  const [customizing, setCustomizing] = useState(
    () => new URLSearchParams(location.search).get('customize') === '1',
  )

  /** 겉모습을 바꾸면 화면에 반영하고 저장도 합니다 */
  const changeLook = (next: Look) => {
    setLook(next)
    saveLook(next)
  }

  // 안내 문구는 2.2초 뒤에 자동으로 지웁니다.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  /** 땅을 눌렀을 때: 그 위치로 걸어가기 */
  const handleTap = (x: number, z: number) => {
    if (customizing) return // 꾸미는 동안에는 걸어가지 않습니다
    const [tx, tz] = resolveTarget(x, z)
    target.current.set(tx, 0, tz)
    setMarker(new THREE.Vector3(tx, 0, tz))
  }

  /** 트리 앞에서 "편지 달기"를 눌렀을 때 */
  const hangLetter = () => {
    if (letters >= MAX_LETTERS) {
      setToast('트리가 편지로 가득 찼어요')
      return
    }
    setLetters(letters + 1)
    setEmote(emote + 1)
    setToast('편지가 장식으로 걸렸어요')
    playChime()
  }

  /** 우체통 앞에서 눌렀을 때 */
  const openMailbox = () => {
    setEmote(emote + 1)
    setToast('편지는 12월 25일에 열 수 있어요')
  }

  return (
    <div className="stage">
      <Canvas shadows camera={{ position: [0, 7.5, 14], fov: 35, far: 600 }} dpr={[1, 2]}>
        <Sky />
        <Stars radius={120} depth={40} count={1400} factor={5} saturation={0} fade speed={0.6} />

        {/* 조명: 저녁 하늘빛(전체) + 따뜻한 노을빛(한쪽에서 비추며 그림자를 만듦) */}
        <hemisphereLight args={['#8f9bf0', '#c9a8a0', 0.85]} />
        <directionalLight
          position={[7, 11, 6]}
          color="#ffd2a8"
          intensity={1.35}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
        />

        <Island />
        <TapPlane onTap={handleTap} />
        <ChristmasTree letters={letters} />
        <House />
        <Mailbox />
        <Snowman />
        <Lamp />
        <Pines />
        <Snow />
        <Footprints playerPos={playerPos} />
        <TargetMarker position={marker} />

        {/* Suspense: 캐릭터 모델을 내려받는 동안 나머지 화면은 먼저 보여줍니다 */}
        <Suspense fallback={null}>
          <Player
            target={target}
            emote={emote}
            onNear={setNear}
            playerPos={playerPos}
            look={look}
            closeUp={customizing}
          />
        </Suspense>

        {/* 후처리: 다 그려진 화면에 사진 필터처럼 효과를 입힙니다 */}
        <EffectComposer multisampling={4}>
          {/* 블룸: 밝게 빛나는 것(전구, 창문, 별) 주변이 뽀얗게 번집니다 */}
          <Bloom mipmapBlur luminanceThreshold={1.5} luminanceSmoothing={0.3} intensity={0.7} />
          {/* 틸트 시프트: 화면 위아래를 흐리게 해서 미니어처 장난감처럼 보이게 합니다 */}
          <TiltShift2 blur={0.09} />
          {/* 비네트: 화면 가장자리를 살짝 어둡게 해서 가운데로 시선을 모읍니다 */}
          <Vignette offset={0.25} darkness={0.5} />
          {/* 톤 매핑: 너무 밝은 색을 화면에 표현할 수 있는 범위로 자연스럽게 눌러 줍니다 */}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>

      {/* 여기부터는 3D 위에 겹쳐 올리는 일반 화면(글자, 버튼)입니다 */}
      <header className="hud">
        <div>
          <p className="hud-label">크리스마스까지</p>
          <p className="hud-dday">D-35</p>
        </div>
        <div className="hud-right">
          <p className="hud-chip">편지 {letters}통</p>
          {!customizing && (
            <button type="button" className="hud-button" onClick={() => setCustomizing(true)}>
              꾸미기
            </button>
          )}
        </div>
      </header>

      {toast && (
        <p className="toast" role="status">
          {toast}
        </p>
      )}

      {customizing ? (
        <Customizer
          look={look}
          onChange={changeLook}
          onClose={() => {
            setCustomizing(false)
            setEmote(emote + 1)
          }}
        />
      ) : (
        <footer className="actions">
          {near === 'tree' && (
            <button type="button" className="action" onClick={hangLetter}>
              트리에 편지 달기
            </button>
          )}
          {near === 'mailbox' && (
            <button type="button" className="action" onClick={openMailbox}>
              우체통 열어보기
            </button>
          )}
          {near === null && <p className="hint">땅을 누르면 그곳으로 걸어가요</p>}
        </footer>
      )}
    </div>
  )
}

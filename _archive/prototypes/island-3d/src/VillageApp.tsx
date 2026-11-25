import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import { playChime } from './App'
import { Effects } from './Effects'
import { loadLook } from './look'
import { Player } from './Player'
import { Footprints, TapPlane, TargetMarker } from './Scenery'
import { STYLES, StyleContext } from './styles'
import type { StyleDef } from './styles'
import { BigTree, ChristmasDecor, Fireworks, FlyingLetter, Ground, Homes, Lamps, VillageSnow } from './Village'
import { LEVEL_LABELS, UNLOCK, giftCount } from './decorPlan'
import { RESIDENTS, mailboxPos } from './residents'
import { TREE_POS, resolveTarget } from './world'
import type { SpotId } from './world'

/** 카메라가 올려다볼 대왕 트리의 위치와 키 */
const BIG_TREE = { ...TREE_POS, height: 8.4 }

// 공유 마을 화면입니다. 그림체는 미니어처로 확정했고, 위쪽 버튼으로 진행률(0~100%)마다 장식이 어떻게 보이는지 시뮬레이션합니다.

/** 편지가 날아가 닿는 곳: 대왕 트리 가운데 앞쪽 */
const LETTER_TARGET: [number, number, number] = [TREE_POS.x, 4.2, TREE_POS.z + 2.2]

/** 장난감 마을(미니어처·빛)의 조명. 사실적인 마을은 real/Atmosphere.tsx 에서 따로 조명을 켭니다. */
function Lights({ style }: { style: StyleDef }) {
  // 그림자를 만드는 조명에 공통으로 쓰는 설정
  const shadow = {
    castShadow: true,
    'shadow-mapSize': [4096, 4096] as [number, number],
    'shadow-camera-left': -24,
    'shadow-camera-right': 24,
    'shadow-camera-top': 24,
    'shadow-camera-bottom': -24,
    'shadow-bias': -0.0004,
    'shadow-normalBias': 0.03,
  }

  if (style.id === 'night') {
    // 미니어처 밤: 푸른 달빛으로 마을 모양은 보이게 하고, 따뜻한 빛은 가로등·집·트리 주변 불빛이 만듭니다
    return (
      <>
        <hemisphereLight args={['#9fb2f0', '#2c3566', 1.0]} />
        <directionalLight position={[-6, 12, 5]} color="#b9c7ff" intensity={0.9} {...shadow} />
      </>
    )
  }
  if (style.id === 'light') {
    // 밤: 전체는 어두운 달빛, 밝은 곳은 창문과 전구가 만듭니다
    return (
      <>
        <hemisphereLight args={['#6f7de0', '#2a2f5a', 0.55]} />
        <directionalLight position={[-6, 10, 5]} color="#9fb0ff" intensity={0.7} {...shadow} />
      </>
    )
  }
  // 미니어처: 스튜디오에서 찍은 모형 사진처럼 깨끗하고 부드러운 빛
  return (
    <>
      {/* 위쪽은 흰빛, 아래쪽(땅에서 반사되는 빛)은 맑은 하늘색 → 눈이 회색이 아니라 하얗게 보입니다 */}
      <hemisphereLight args={['#ffffff', '#dfe9f7', 1.7]} />
      {/* 햇빛은 살짝 따뜻한 색으로 → 그늘(푸른빛)과 대비되어 화사해집니다 */}
      <directionalLight position={[7, 12, 6]} color="#fff6ea" intensity={2.4} {...shadow} />
    </>
  )
}

export default function VillageApp({ style: dayStyle }: { style: StyleDef }) {
  // 낮/밤 바꾸기. 주소에 &night 를 붙이면 밤으로 시작합니다.
  const [night, setNight] = useState(() => new URLSearchParams(location.search).has('night'))
  const style = night ? STYLES.night : dayStyle
  const target = useRef(new THREE.Vector3(0, 0, 3.5))
  const playerPos = useRef(new THREE.Vector3(0, 0, 3.5))
  const [marker, setMarker] = useState<THREE.Vector3 | null>(null)
  const [near, setNear] = useState<SpotId | null>(null)
  // 진행률 단계(0~10). 진행률 = level x 10%. 처음에는 0(빈 마을)입니다.
  // 주소에 &p=40 처럼 적으면 그 진행률로 시작합니다.
  const [level, setLevel] = useState(() => {
    const p = Number(new URLSearchParams(location.search).get('p'))
    return Number.isFinite(p) ? Math.min(10, Math.max(0, Math.round(p / 10))) : 0
  })
  // 누구에게 편지를 걸었는지. 처음에는 아무에게도 걸지 않았습니다.
  const [sent, setSent] = useState<Record<string, boolean>>({})
  // 지금 날아가고 있는 편지들. slot 은 대왕 트리의 몇 번째 장식 자리로 가는지입니다.
  const [flights, setFlights] = useState<{ id: number; from: [number, number, number] }[]>([])
  const [emote, setEmote] = useState(0)
  const [toast, setToast] = useState('')
  const [look] = useState(loadLook)
  // true 면 카메라가 물러나 대왕 트리 전체를 보여 줍니다 (버튼으로 켜고 끕니다)
  const [treeView, setTreeView] = useState(() => new URLSearchParams(location.search).has('tree'))

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(timer)
  }, [toast])

  const handleTap = (x: number, z: number) => {
    setTreeView(false) // 땅을 눌러 걷기 시작하면 평소 시점으로 돌아갑니다
    const [tx, tz] = resolveTarget(x, z)
    target.current.set(tx, 0, tz)
    setMarker(new THREE.Vector3(tx, 0, tz))
  }

  // 지금 가까이 있는 주민 (대왕 트리나 아무것도 없으면 undefined)
  const resident = RESIDENTS.find((r) => r.id === near)
  const friendName = resident?.name.replace('네', '')

  /** 친구 집 앞 우체통에 편지 넣기 → 편지가 대왕 트리로 날아가 장식이 됩니다 */
  const hangLetter = () => {
    if (!resident) return
    const tree = mailboxPos(resident)
    setSent({ ...sent, [resident.id]: true })
    setFlights([...flights, { id: Date.now(), from: [tree.x, 1.4, tree.z] }])
    setEmote(emote + 1)
    setToast('편지가 대왕 트리로 날아가요')
  }

  // 확인용: 주소에 &fly=1 을 붙이면 화면이 뜨고 2초 뒤에 민지네 우체통에서 편지가 자동으로 날아갑니다.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('fly')) return
    const tree = mailboxPos(RESIDENTS[0])
    const timer = setTimeout(() => {
      setSent((s) => ({ ...s, [RESIDENTS[0].id]: true }))
      setFlights((list) => [...list, { id: Date.now(), from: [tree.x, 1.4, tree.z] }])
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  /** 편지가 대왕 트리에 닿은 순간: 진행률이 10% 오르고 그 단계의 장식이 생깁니다 (시뮬레이션용) */
  const letterArrived = () => {
    setLevel((n) => {
      const next = Math.min(10, n + 1)
      setToast(`진행률 ${next * 10}% · ${LEVEL_LABELS[next]}`)
      return next
    })
    playChime()
  }

  return (
    <div className={style.lightBackground ? 'stage on-light' : 'stage'} style={{ background: style.background }}>
      <Canvas shadows camera={{ position: [0, 17, 27], fov: 42, far: 600 }} dpr={[1, 2]}>
        {/* 이 안의 모든 부품이 "지금 그림체"를 꺼내 쓸 수 있게 합니다 */}
        <StyleContext.Provider value={style}>
          <color attach="background" args={[style.background]} />
          {/* 안개: 멀리 있는 것일수록 배경색에 섞여서, 땅의 끝이 보이지 않고 자연스럽게 사라집니다 */}
          <fog attach="fog" args={[style.background, ...style.fog]} />
          {style.night && (
            <Stars radius={120} depth={40} count={1400} factor={5} saturation={0} fade speed={0.6} />
          )}
          {style.kit === 'toy' && <Lights style={style} />}

          {/* Suspense: 3D 모델·텍스처 파일을 내려받는 동안 기다렸다가, 다 받으면 한꺼번에 보여줍니다 */}
          <Suspense fallback={null}>
            <Ground />
            <BigTree level={level} />
            <Homes sent={sent} level={level} />
            <Lamps />
            <ChristmasDecor level={level} />
            <VillageSnow />
            {level >= UNLOCK.starAndFireworks && <Fireworks />}
            <TapPlane onTap={handleTap} />
            {flights.map((f) => (
              <FlyingLetter
                key={f.id}
                from={f.from}
                to={LETTER_TARGET}
                onArrive={letterArrived}
                onDone={() => setFlights((list) => list.filter((x) => x.id !== f.id))}
              />
            ))}
            <Footprints playerPos={playerPos} />
            <TargetMarker position={marker} />
          </Suspense>

          <Suspense fallback={null}>
            <Player target={target} emote={emote} onNear={setNear} playerPos={playerPos} look={look} closeUp={false} zoom={1.4} landmark={treeView ? BIG_TREE : null} />
          </Suspense>

          <Effects style={style.id} />
        </StyleContext.Provider>
      </Canvas>

      <header className="hud">
        <div>
          <p className="hud-label">고등학교 친구들 마을</p>
          <p className="hud-dday">D-34</p>
          <p className="hud-label">크리스마스까지</p>
        </div>
        <div className="hud-right">
          <p className="hud-chip">진행률 {level * 10}%</p>
          {/* 낮/밤 바꾸기 */}
          <button type="button" className="chip" aria-pressed={night} onClick={() => setNight(!night)}>
            {night ? '☀️ 낮으로' : '🌙 밤으로'}
          </button>
        </div>
      </header>

      {/* 진행률 고르기: 누르면 그 단계의 장식이 보입니다 (앞 단계 장식은 모두 남아 있습니다) */}
      <nav className="style-switch" aria-label="진행률 고르기">
        {LEVEL_LABELS.map((_, i) => (
          <button key={i} type="button" className="chip" aria-pressed={i === level} onClick={() => setLevel(i)}>
            {i * 10}%
          </button>
        ))}
      </nav>
      <p className="level-caption">
        <strong>{level * 10}%</strong> {LEVEL_LABELS[level]}
        {level > 0 && <span> · 선물 {giftCount(level)}개</span>}
      </p>

      {toast && (
        <p className="toast" role="status">
          {toast}
        </p>
      )}

      <footer className="actions">
        <button type="button" className="action" onClick={() => setTreeView(!treeView)}>
          {treeView ? '마을로 돌아가기' : '트리 전체 보기'}
        </button>
        {near === 'tree' && (
          <button type="button" className="action" onClick={() => setToast(`우리 마을 진행률은 ${level * 10}%예요`)}>
            대왕 트리 살펴보기
          </button>
        )}
        {resident && resident.id === 'me' && (
          <button type="button" className="action" onClick={() => setToast('받은 편지 2통은 12월 25일에 열려요')}>
            내 우체통의 편지 보기
          </button>
        )}
        {resident && resident.id !== 'me' && !sent[resident.id] && (
          <button type="button" className="action" onClick={hangLetter}>
            {friendName}에게 편지 넣기
          </button>
        )}
        {resident && resident.id !== 'me' && sent[resident.id] && (
          <p className="hint">{friendName}에게는 이미 편지를 넣었어요</p>
        )}
        {near === null && <p className="hint">땅을 누르면 그곳으로 걸어가요</p>}
      </footer>
    </div>
  )
}

import { CHARACTER_TYPES, HAIR_COLORS, OUTFIT_COLORS, SKIN_COLORS } from './look'
import type { Look } from './look'

// 캐릭터 꾸미기 화면(아래에서 올라오는 패널)입니다.
// 무언가를 고를 때마다 onChange 로 새 설정을 알려주고, 3D 캐릭터에 바로 반영됩니다.

type Props = {
  look: Look
  onChange: (look: Look) => void
  onClose: () => void
}

/** 색 고르기 한 줄. value 가 null 이면 "기본(원래 색)"이 선택된 상태입니다. */
function ColorRow(props: {
  title: string
  colors: string[]
  value: string | null
  onPick: (color: string | null) => void
}) {
  return (
    <div className="row">
      <p className="row-title">{props.title}</p>
      <div className="swatches">
        <button
          type="button"
          className="swatch swatch-default"
          aria-label={`${props.title} 기본`}
          aria-pressed={props.value === null}
          onClick={() => props.onPick(null)}
        >
          기본
        </button>
        {props.colors.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            style={{ background: color }}
            aria-label={`${props.title} ${color}`}
            aria-pressed={props.value === color}
            onClick={() => props.onPick(color)}
          />
        ))}
      </div>
    </div>
  )
}

export function Customizer({ look, onChange, onClose }: Props) {
  const current = CHARACTER_TYPES.find((t) => t.id === look.type)!

  return (
    <section className="sheet" aria-label="캐릭터 꾸미기">
      <div className="sheet-head">
        <h2>캐릭터 꾸미기</h2>
        <button type="button" className="sheet-done" onClick={onClose}>
          완료
        </button>
      </div>

      <div className="row">
        <p className="row-title">머리 모양</p>
        <div className="chips">
          {CHARACTER_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="chip"
              aria-pressed={look.type === t.id}
              onClick={() => onChange({ ...look, type: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ColorRow
        title="머리색"
        colors={HAIR_COLORS}
        value={look.hair}
        onPick={(hair) => onChange({ ...look, hair })}
      />
      <ColorRow
        title="옷 색"
        colors={OUTFIT_COLORS}
        value={look.outfit}
        onPick={(outfit) => onChange({ ...look, outfit })}
      />
      <ColorRow
        title="피부색"
        colors={SKIN_COLORS}
        value={look.skin}
        onPick={(skin) => onChange({ ...look, skin })}
      />

      <div className="row">
        <p className="row-title">액세서리</p>
        <div className="chips">
          <button
            type="button"
            className="chip"
            aria-pressed={look.cape}
            onClick={() => onChange({ ...look, cape: !look.cape })}
          >
            망토
          </button>
          {current.hasHat && (
            <button
              type="button"
              className="chip"
              aria-pressed={look.hat}
              onClick={() => onChange({ ...look, hat: !look.hat })}
            >
              모자
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

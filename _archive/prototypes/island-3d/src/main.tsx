import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './bend' // 둥근 지형 효과 (다른 3D 코드보다 먼저 불러와야 합니다)
import './index.css'
import VillageApp from './VillageApp.tsx'
import { STYLES } from './styles'

// 그림체는 미니어처로 확정했으므로 항상 미니어처 공유 마을을 보여 줍니다.
// (다른 그림체 코드는 참고용으로 남겨 두었지만 화면에서는 고를 수 없습니다)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VillageApp style={STYLES.diorama} />
  </StrictMode>,
)

# _archive (보관함)

2026-11-25에 실제 웹 개발을 새로 시작하면서, 그 전에 만든 시안·실험물을 이 폴더 하나에 모아 접어 두었습니다.
**실제 앱 코드가 아닙니다.** 디자인을 나중에 확인할 때 참고용으로만 씁니다.

| 폴더 | 내용 |
|------|------|
| `prototypes/island-3d/` | 3D 마을 맛보기(시뮬레이터). 장식표 0~100% 단계, 미니어처 낮/밤, 트리 장식, 집 크리스마스 꾸미기를 확인할 수 있음 |
| `assets/character/` | Blender + Claude로 만든 캐릭터 시안 1종 (`character.glb`, 미리보기 그림, 만드는 스크립트 `build_character.py`) |
| `screenshots/` | 시뮬레이터를 확인하며 찍은 화면들 (Playwright 스크린샷) |

## 시뮬레이터 다시 켜는 법

```bash
cd _archive/prototypes/island-3d
npx vite --port 5190
```

브라우저에서 `http://localhost:5190/?p=100` (진행률 100%), 밤으로 보려면 `http://localhost:5190/?p=100&night`

# 전나무 가지 한 개를 위에서 내려다본 그림을 그립니다. (11.26 사용자 요청: 잎이 더 전나무답게)
# 대왕 트리(scripts/blender/make_fir.py)가 이 그림을 가지 모양 판에 입혀서 씁니다.
#
# 실행 방법 (터미널, 그림 그리는 도구 Pillow가 필요합니다):
#   python3 scripts/blender/make_fir_branch_texture.py scripts/blender/fir_branch.png
#
# 그리는 순서
#  1) 가운데 줄기: 그림 아래(나무 줄기 쪽)에서 위(가지 끝)로
#  2) 잔가지: 줄기 양옆으로 마주 보며 앞쪽으로 비스듬히. 가운데쯤이 가장 길고 끝으로 갈수록 짧아져 전체가 길쭉한 세모꼴
#  3) 바늘잎: 줄기와 잔가지마다 짧은 바늘잎을 양쪽으로 촘촘히. 안쪽은 짙은 청록, 끝의 새잎은 밝은 초록
# 바탕은 투명입니다. 앱에서는 투명한 부분을 잘라 내고 그립니다.
# random.seed가 고정이라 항상 같은 그림이 나옵니다.

import math
import random
import sys

from PIL import Image, ImageDraw

OUT = sys.argv[1] if len(sys.argv) > 1 else "fir_branch.png"
SIZE = 512  # 최종 그림 크기
SCALE = 4  # 크게 그린 뒤 줄여서 가장자리를 매끈하게
S = SIZE * SCALE
random.seed(1225)

# 색 (R, G, B): 그늘진 안쪽 → 보통 → 가지 끝의 새잎
# 💡 화면에서는 이 색에 빛과 그늘이 한 번 더 곱해져 어두워지므로, 그림은 실제보다 밝게 그립니다
DARK = (30, 82, 58)
MID = (48, 114, 74)
LIGHT = (116, 176, 114)
TWIG = (52, 44, 30)  # 잔가지(나무색). 바늘잎에 거의 가려집니다

layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
draw = ImageDraw.Draw(layer)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3))


def px(u, v):
    """그림 좌표: u=가로(0~1), v=세로(0=줄기 쪽, 1=가지 끝). 그림 파일은 위가 0이라 뒤집습니다"""
    return (u * S, (1.0 - v) * S)


def line(p, q, color, width):
    draw.line([px(*p), px(*q)], fill=color + (255,), width=max(1, int(width * SCALE)))


needles = []  # (그릴 순서용 밝기, 시작점, 끝점, 색, 굵기)


def add_needles(p, q, length, tipness):
    """p에서 q로 가는 가지를 따라 양쪽에 바늘잎을 답니다. tipness가 클수록(끝쪽) 밝은 새잎"""
    dx, dy = q[0] - p[0], q[1] - p[1]
    dist = math.hypot(dx, dy)
    if dist == 0:
        return
    ux, uy = dx / dist, dy / dist
    count = max(2, int(dist / 0.0075))
    for i in range(count + 1):
        f = i / count
        bx, by = p[0] + dx * f, p[1] + dy * f
        for sign in (1, -1):
            # 바늘잎은 가지 방향에서 55도쯤 앞으로 비스듬히 납니다
            a = math.radians(random.uniform(42, 68)) * sign
            nx = ux * math.cos(a) - uy * math.sin(a)
            ny = ux * math.sin(a) + uy * math.cos(a)
            n = length * random.uniform(0.75, 1.15) * (1.0 - 0.35 * f)
            bright = tipness * (0.45 + 0.55 * f) + random.uniform(-0.18, 0.18)
            color = mix(DARK, MID, bright * 2) if bright < 0.5 else mix(MID, LIGHT, bright * 2 - 1)
            needles.append((bright, (bx, by), (bx + nx * n, by + ny * n), color, random.uniform(2.0, 2.9)))


def branch(p, angle, length, needle, tipness, depth):
    """p에서 angle 방향(0=위)으로 뻗는 가지 하나. 길면 곁가지도 답니다"""
    q = (p[0] + math.sin(angle) * length, p[1] + math.cos(angle) * length)
    line(p, q, TWIG, 2.2 if depth == 0 else 1.6)
    add_needles(p, q, needle, tipness)
    # 가지 끝의 뾰족한 새순
    tip = (q[0] + math.sin(angle) * needle * 0.9, q[1] + math.cos(angle) * needle * 0.9)
    needles.append((1.0, q, tip, LIGHT, 2.0))
    if depth == 0 and length > 0.17:
        # 긴 잔가지에는 작은 곁가지를 양쪽에 하나씩
        for sign, at in ((1, 0.42), (-1, 0.62)):
            base = (p[0] + (q[0] - p[0]) * at, p[1] + (q[1] - p[1]) * at)
            branch(base, angle + sign * math.radians(34), length * (1 - at) * 0.72, needle * 0.85, tipness, 1)


# 1) 가운데 줄기
STEM_FROM, STEM_TO = 0.015, 0.90
line((0.5, STEM_FROM), (0.5, STEM_TO), TWIG, 3.2)
add_needles((0.5, STEM_FROM), (0.5, STEM_TO), 0.030, 0.35)

# 2) 잔가지 쌍
PAIRS = 12
for i in range(PAIRS):
    s = (i + 0.5) / PAIRS
    v = STEM_FROM + (STEM_TO - STEM_FROM) * s
    # 길이: 줄기 쪽은 조금 짧고, 1/4 지점에서 가장 길고, 끝으로 갈수록 짧아집니다
    length = 0.47 * (0.45 + 0.55 * min(1.0, s * 4.0)) * (1.0 - s) ** 0.8
    spread = math.radians(62 - 22 * s)  # 끝으로 갈수록 앞쪽으로 더 눕습니다
    for sign in (1, -1):
        branch(
            (0.5, v + random.uniform(-0.008, 0.008)),
            sign * (spread + random.uniform(-0.06, 0.06)),
            length * random.uniform(0.9, 1.06),
            0.034,
            0.35 + 0.5 * s,
            0,
        )
# 가지 맨 끝
branch((0.5, STEM_TO), 0.0, 0.07, 0.030, 1.0, 1)

# 3) 바늘잎: 어두운 것부터 그려서 밝은 새잎이 위에 오게
for _, p, q, color, width in sorted(needles, key=lambda n: n[0]):
    line(p, q, color, width)

# 줄여서 저장. 투명한 곳의 색은 초록으로 채워 둡니다 (멀리서 볼 때 가장자리가 검게 번지지 않게)
small = layer.resize((SIZE, SIZE), Image.LANCZOS)
alpha = small.getchannel("A").point(lambda a: min(255, int(a * 1.7)))  # 가는 바늘잎이 멀리서 사라지지 않게 조금 두껍게
base = Image.new("RGB", (SIZE, SIZE), MID)
base.paste(small.convert("RGB"), mask=small.getchannel("A"))
result = base.convert("RGBA")
result.putalpha(alpha)
result.save(OUT)
print(f"[fir_branch] saved {OUT} ({SIZE}x{SIZE}, needles={len(needles)})")

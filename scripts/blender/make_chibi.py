# Blender로 2.2등신 캐릭터(여자·남자) 기본 틀을 만드는 스크립트입니다. (Task 014, 11.28 사용자 도안)
#
# 실행 방법 (터미널):
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/make_chibi.py -- public/models/handmade
#   (미리보기 그림도 함께 뽑기)
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/make_chibi.py -- public/models/handmade --preview 미리보기_폴더
#
# 결과: chibi_girl.glb, chibi_boy.glb
#
# 만드는 방식
#  - 큰 머리 + 작은 몸의 2.2등신. 키는 약 0.92 (앱에서 원하는 크기로 키웁니다)
#  - 얼굴(눈·눈썹·볼터치·입)은 모양이 아니라 "그림"입니다. 이 스크립트가 코드로 그려서 머리 앞면에 입힙니다.
#  - 옷은 기본 옷(가디건 + 치마/반바지)입니다. 나중에 꾸미기에서 부위별로 갈아 끼울 수 있게
#    머리카락(Hair)·상의(Top)·하의(Bottom)를 따로따로 된 조각으로 만들었습니다.
#  - 뼈대(스킨)는 없습니다. 대신 팔·다리·머리를 "회전축이 어깨·골반·목에 있는 빈 상자(노드)" 아래에 넣어서,
#    앱에서 그 노드만 돌리면 걷는 동작을 만들 수 있습니다.
#      Chibi (전체)
#       ├─ Head (목이 회전축) : HeadSkin(얼굴 그림), Hair
#       ├─ Torso              : Neck, Top, Collar, 리본/넥타이, 단추, Bottom
#       ├─ ArmL / ArmR (어깨가 회전축) : 소매, 손
#       └─ LegL / LegR (골반이 회전축) : 다리, 양말, 신발 (남자는 반바지 자락 포함)
#  - 방향: 캐릭터는 Blender에서 -Y를 바라봅니다 (내보내면 앱에서 +Z, 지금 쓰는 캐릭터와 같은 방향)
#
# 숫자(색·크기·머리 길이)를 바꾸고 다시 실행하면 모양을 쉽게 다듬을 수 있습니다.

import math
import os
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

# ---- 옵션 읽기 ("--" 뒤에 오는 값들) ---------------------------------------
ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT_DIR = ARGS[0] if ARGS and not ARGS[0].startswith("--") else "."
PREVIEW_DIR = ARGS[ARGS.index("--preview") + 1] if "--preview" in ARGS else None
# --catalog 폴더: 옷 디자인 시안 그림만 뽑습니다
CATALOG_DIR = ARGS[ARGS.index("--catalog") + 1] if "--catalog" in ARGS else None
CATALOG = {
    "top": ["cardigan", "sweater", "puffer", "hoodie", "santa"],
    "bottom": ["skirt", "shorts", "pants"],
    "gloves": ["none", "mitten", "knit"],
    "scarf": ["none", "muffler"],
    "shoes": ["loafer", "boots", "sneaker"],
}
# 섞어 입힌 예시
COMBOS = [
    ("girl", dict(top="sweater", bottom="skirt", gloves="mitten", scarf="muffler", shoes="boots")),
    ("boy", dict(top="puffer", bottom="pants", gloves="knit", scarf="muffler", shoes="boots")),
    ("boy", dict(top="sweater", bottom="shorts", gloves="none", scarf="muffler", shoes="sneaker")),
    ("boy", dict(top="puffer", bottom="pants", gloves="none", scarf="muffler", shoes="boots")),
    ("girl", dict(top="santa", bottom="skirt", gloves="mitten", scarf="none", shoes="boots")),
    ("boy", dict(top="hoodie", bottom="pants", gloves="none", scarf="none", shoes="sneaker")),
]
# --thumbs 폴더: 꾸미기 창의 옷 카드에 쓰는 작은 그림(옷만, 투명 바탕)을 모양 × 색마다 뽑습니다
THUMB_DIR = ARGS[ARGS.index("--thumbs") + 1] if "--thumbs" in ARGS else None
# --kit 파일: 앱이 쓰는 묶음 파일(모든 옷 모양이 들어 있는 chibi.glb)을 만듭니다
KIT_PATH = ARGS[ARGS.index("--kit") + 1] if "--kit" in ARGS else None
# --colors 폴더: 색 시안 그림만 뽑습니다
COLOR_DIR = ARGS[ARGS.index("--colors") + 1] if "--colors" in ARGS else None
COLOR_COMBOS = [
    ("girl", dict(top="santa", top_color="green", bottom="skirt", bottom_color="cream", gloves="mitten", gloves_color="green", scarf="muffler", scarf_color="red", shoes="boots", shoes_color="black")),
    ("boy", dict(top="puffer", top_color="navy", bottom="pants", bottom_color="cream", gloves="knit", gloves_color="red", scarf="muffler", scarf_color="yellow", shoes="boots", shoes_color="brown")),
    ("girl", dict(top="sweater", top_color="purple", bottom="pants", bottom_color="black", gloves="none", scarf="muffler", scarf_color="pink", shoes="sneaker", shoes_color="yellow")),
    ("boy", dict(top="hoodie", top_color="yellow", bottom="shorts", bottom_color="brown", gloves="knit", gloves_color="sky", scarf="none", shoes="sneaker", shoes_color="sky")),
    ("girl", dict(top="cardigan", top_color="cream", bottom="skirt", bottom_color="red", gloves="mitten", gloves_color="pink", scarf="none", shoes="loafer", shoes_color="brown")),
    ("boy", dict(top="sweater", top_color="green", bottom="pants", bottom_color="navy", gloves="mitten", gloves_color="black", scarf="muffler", scarf_color="cream", shoes="loafer", shoes_color="black")),
]
# 얼굴 그림 종류: oval(까만 타원 눈, 11.28 사용자 확정) / anime(처음 안) / bead(구슬 눈) / soft(다듬은 애니메이션 눈)
FACE = ARGS[ARGS.index("--face") + 1] if "--face" in ARGS else "oval"

# ---- 몸 크기 (두 캐릭터 공통) ----------------------------------------------
HEAD_Z = 0.66  # 머리 중심 높이
RX, RY, RZ = 0.27, 0.245, 0.235  # 머리 반지름 (가로, 앞뒤, 세로): 옆으로 넓적한 머리
NECK_Z = 0.455  # 목 (머리 회전축)
SHOULDER = (0.118, 0.0, 0.425)  # 어깨 (팔 회전축)
HIP = (0.068, 0.0, 0.215)  # 골반 (다리 회전축)
ARM_SPREAD = math.radians(48)  # 팔을 옆으로 벌린 각도 (0 = 차렷)
TORSO_DEPTH = 0.78  # 몸통 앞뒤 두께 비율 (가로 대비)

# 상의(가디건) 옆모습 선: (반지름, 높이)를 아래에서 위로
TOP_PROFILE = [
    (0.146, 0.236),
    (0.157, 0.243),
    (0.157, 0.268),
    (0.150, 0.276),
    (0.147, 0.33),
    (0.134, 0.39),
    (0.112, 0.432),
    (0.075, 0.456),
    (0.045, 0.462),
]

# ---- 색 --------------------------------------------------------------------
SKIN = "#fde0cb"
PALETTE = {
    "girl": dict(
        hair="#8a5a3c", hair_dark="#5a3724", top="#f4b9c1", bottom="#2f3f6b",
        collar="#cfdaf2", accent="#2a3a66", sock="#fbfbfb", shoe="#25252b", button="#fff6e8",
        iris_dark="#4a2a1c", iris_light="#b98458",
    ),
    "boy": dict(
        hair="#4a3427", hair_dark="#2f2019", top="#a9c3e6", bottom="#2f3f6b",
        collar="#f4f6fb", accent="#2a3a66", sock="#fbfbfb", shoe="#25252b", button="#fff6e8",
        iris_dark="#33221a", iris_light="#8f6a4c",
    ),
}


def srgb(hex_color):
    """'#rrggbb' → 0~1 사이 숫자 3개 (화면에 보이는 색 그대로)"""
    h = hex_color.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)])


def linear(hex_color):
    """화면 색 → Blender 재질이 쓰는 선형 색 (RGBA)"""
    c = srgb(hex_color)
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return (*lin, 1.0)


def make_material(name, hex_color=None, image=None, rough=0.85):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    if image is not None:
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = linear(hex_color)
    return mat


# ---- 모양 만들기 도구 --------------------------------------------------------
def add_ellipsoid(bm, center, radii, seg=24, rings=14, min_z=None):
    """찌그러뜨린 공. min_z를 주면 그 높이 아래는 평평하게 누릅니다 (신발 바닥)"""
    m = Matrix.Translation(center) @ Matrix.Diagonal((*radii, 1.0))
    verts = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0, matrix=m)["verts"]
    if min_z is not None:
        for v in verts:
            v.co.z = max(v.co.z, min_z)
    return verts


def add_slab(bm, center, half, tilt=0.0, power=0.45):
    """모서리가 둥근 납작한 판 (목도리 자락). tilt = 좌우로 기울인 각도"""
    verts = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0)["verts"]
    c, sn = math.cos(tilt), math.sin(tilt)
    for v in verts:
        # 공을 상자 쪽으로 부풀린 뒤(모서리만 둥글게 남음) 크기를 맞춥니다
        x, y, z = (math.copysign(abs(a) ** power, a) * h for a, h in zip(v.co, half))
        v.co = (center[0] + x * c + z * sn, center[1] + y, center[2] - x * sn + z * c)


def add_lathe(bm, profile, seg=24, cx=0.0, cy=0.0, sx=1.0, sy=1.0, mod=None, cap_bottom=True, cap_top=True):
    """옆모습 선(반지름, 높이)을 한 바퀴 돌려 만든 통. mod(각도, 줄 번호)로 반지름을 조금씩 바꿀 수 있습니다 (주름)"""
    rings = []
    for i, (r, z) in enumerate(profile):
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            m = mod(a, i) if mod else 1.0
            ring.append(bm.verts.new((cx + math.cos(a) * r * sx * m, cy + math.sin(a) * r * sy * m, z)))
        rings.append(ring)
    for lo, hi in zip(rings, rings[1:]):
        for k in range(seg):
            n = (k + 1) % seg
            bm.faces.new((lo[k], lo[n], hi[n], hi[k]))
    if cap_bottom:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top:
        bm.faces.new(rings[-1])


def profile_radius(profile, z):
    """옆모습 선에서 높이 z일 때의 반지름"""
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return profile[-1][0]


def finish(name, bm, material, parent, local=False):
    """bmesh를 물체로 만들어 부모 노드 아래에 넣습니다. local이 아니면 지금 자리(전체 기준 좌표)를 그대로 지킵니다"""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    if not local:
        obj.matrix_parent_inverse = Matrix.Translation(-Vector(parent.location))
    return obj


def add_pivot(name, location, parent=None):
    """회전축 역할을 하는 빈 노드"""
    obj = bpy.data.objects.new(name, None)
    obj.location = location
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def tri(x):
    """-1 ~ 1 사이를 오가는 톱니 물결 (머리카락 끝, 치마 주름)"""
    return 4 * abs(x - math.floor(x) - 0.5) - 1


# ---- 얼굴 그림 ---------------------------------------------------------------
FACE_SIZE = 512


def draw_face(kind, colors):
    """머리 앞면에 입힐 얼굴 그림(눈·눈썹·볼터치·입)을 그립니다. 좌표 단위는 머리 중심에서의 거리(모델과 같은 단위)"""
    n = FACE_SIZE
    xs = (np.arange(n) + 0.5) / n * 2 * RX - RX
    zs = (np.arange(n) + 0.5) / n * 2 * RZ - RZ
    X, Z = np.meshgrid(xs, zs)  # 0번째 줄이 그림의 맨 아래
    aa = 2 * RX / n * 1.2  # 가장자리를 부드럽게 하는 폭 (약 1픽셀)
    img = np.empty((n, n, 3))
    img[:] = srgb(SKIN)

    def sm(e0, e1, x):
        t = np.clip((x - e0) / (e1 - e0), 0, 1)
        return t * t * (3 - 2 * t)

    def ellipse(cx, cz, rx, rz):
        """타원 안쪽이면 1, 바깥이면 0 (가장자리는 부드럽게)"""
        d = (np.sqrt(((X - cx) / rx) ** 2 + ((Z - cz) / rz) ** 2) - 1) * min(rx, rz)
        return 1 - sm(-aa, aa, d)

    def stroke(points, width):
        """점들을 이은 선"""
        d = np.full_like(X, 1e9)
        for (ax, az), (bx, bz) in zip(points, points[1:]):
            vx, vz = bx - ax, bz - az
            if vx == 0 and vz == 0:
                continue  # 같은 점이 두 번 이어지면 건너뜁니다 (0으로 나누기 방지)
            t = np.clip(((X - ax) * vx + (Z - az) * vz) / (vx * vx + vz * vz), 0, 1)
            d = np.minimum(d, np.hypot(X - ax - t * vx, Z - az - t * vz))
        return 1 - sm(-aa, aa, d - width / 2)

    def put(color, mask):
        c = srgb(color) if isinstance(color, str) else color
        img[:] = img * (1 - mask[..., None]) + c * mask[..., None]

    girl = kind == "girl"
    line = "#2b1a14"

    def smile(cz, r, deg=45):
        """아래로 둥근 미소 선"""
        return [(r * math.cos(a), cz + r + r * math.sin(a)) for a in np.linspace(math.radians(270 - deg), math.radians(270 + deg), 12)]

    def cat_mouth(cz, r):
        """고양이 입(ω): 아래로 둥근 곡선 두 개"""
        pts = [(-r + r * math.cos(a), cz + r * math.sin(a)) for a in np.linspace(math.pi, 2 * math.pi, 12)]
        return pts + [(r + r * math.cos(a), cz + r * math.sin(a)) for a in np.linspace(math.pi, 2 * math.pi, 12)]

    if FACE == "anime":
        # 처음 만든 안: 테두리가 굵은 큰 애니메이션 눈
        ex, ez = 0.108, -0.032
        rx, rz = (0.052, 0.063) if girl else (0.046, 0.055)
        for sgn in (-1, 1):
            cx = sgn * ex
            blush = np.exp(-(((X - sgn * 0.168) / 0.046) ** 2 + ((Z + 0.108) / 0.022) ** 2))
            put("#f6a39d", blush * (0.6 if girl else 0.38))
            iris = ellipse(cx, ez, rx, rz)
            t = np.clip((Z - (ez - rz)) / (2 * rz), 0, 1)[..., None] ** 0.8
            put(srgb(colors["iris_light"]) * (1 - t) + srgb(colors["iris_dark"]) * t, iris)
            put(line, ellipse(cx, ez + 0.008, rx * 0.5, rz * 0.55) * 0.8)
            put("#e2ad7e", ellipse(cx, ez - rz * 0.55, rx * 0.55, rz * 0.24) * iris * 0.55)
            put(line, iris * (1 - ellipse(cx, ez, rx - 0.005, rz - 0.005)))
            arc = [
                (cx + sgn * rx * 1.12 * math.cos(a), ez + rz * 1.04 * math.sin(a))
                for a in np.linspace(math.radians(8), math.radians(172), 24)
            ]
            put(line, stroke(arc, 0.017 if girl else 0.013))
            if girl:
                ox, oz = arc[0]
                put(line, stroke([(ox, oz + 0.004), (ox + sgn * 0.022, oz + 0.02)], 0.009))
            put("#ffffff", ellipse(cx - 0.019, ez + 0.026, 0.015, 0.018))
            put("#ffffff", ellipse(cx + 0.02, ez - 0.03, 0.007, 0.008) * 0.9)
            bz = ez + rz + (0.04 if girl else 0.034)
            brow = [(cx + dx, bz + 0.008 * (1 - (dx / 0.032) ** 2)) for dx in np.linspace(-0.032, 0.032, 9)]
            put(colors["hair_dark"], stroke(brow, 0.006 if girl else 0.011))
        put("#6b3a2a", stroke(cat_mouth(-0.118, 0.015) if girl else smile(-0.128, 0.032), 0.0065))

    elif FACE == "oval":
        # A안: 세로로 긴 까만 타원 눈 + 반짝임 하나 (동물의 숲 주민, 플레이투게더 계열)
        ex, ez = 0.098, -0.058
        rx, rz = 0.027, 0.041
        for sgn in (-1, 1):
            cx = sgn * ex
            blush = np.exp(-((((X - sgn * 0.17) / 0.036) ** 2 + ((Z + 0.125) / 0.026) ** 2) ** 1.5))
            put("#f79c98", blush * (0.62 if girl else 0.4))
            put(line, ellipse(cx, ez, rx, rz))
            put("#5a3a2c", ellipse(cx, ez - rz * 0.45, rx * 0.62, rz * 0.34) * 0.55)  # 아래쪽 은은한 갈색 빛
            put("#ffffff", ellipse(cx - 0.009, ez + 0.017, 0.0095, 0.0115))
            if girl:
                # 속눈썹: 눈꼬리에서 바깥 위로 짧게
                put(line, stroke([(cx + sgn * rx * 0.75, ez + rz * 0.62), (cx + sgn * (rx + 0.017), ez + rz + 0.004)], 0.008))
            bz = ez + rz + (0.036 if girl else 0.03)
            brow = [(cx + dx, bz + 0.006 * (1 - (dx / 0.026) ** 2)) for dx in np.linspace(-0.026, 0.026, 9)]
            put(colors["hair_dark"], stroke(brow, 0.0055 if girl else 0.009))
        put("#7a4030", stroke(cat_mouth(-0.132, 0.012) if girl else smile(-0.142, 0.024), 0.006))

    elif FACE == "bead":
        # B안: 작고 동그란 구슬 눈 (젤다 꿈꾸는 섬 리메이크, 본디 계열): 눈을 낮고 넓게 두는 인형 얼굴
        ex, ez = 0.112, -0.075
        r = 0.021
        for sgn in (-1, 1):
            cx = sgn * ex
            blush = np.exp(-((((X - sgn * 0.172) / 0.034) ** 2 + ((Z + 0.128) / 0.024) ** 2) ** 1.5))
            put("#f79c98", blush * (0.6 if girl else 0.38))
            put("#241612", ellipse(cx, ez, r, r * 1.08))
            put("#ffffff", ellipse(cx - 0.007, ez + 0.008, 0.0062, 0.0068))
            if girl:
                put("#241612", stroke([(cx + sgn * r * 0.7, ez + r * 0.7), (cx + sgn * (r + 0.013), ez + r + 0.009)], 0.0065))
            else:
                bz = ez + r + 0.03
                put(colors["hair_dark"], stroke([(cx - 0.02, bz), (cx + 0.02, bz + sgn * -0.004)], 0.008))
        put("#7a4030", stroke(cat_mouth(-0.122, 0.01) if girl else smile(-0.13, 0.018), 0.0055))

    else:
        # C안: 다듬은 애니메이션 눈 (넨도로이드 인형, 포켓몬 BDSP 계열): 테두리 없이 부드러운 눈동자 + 가는 눈꺼풀 선
        ex, ez = 0.1, -0.048
        rx, rz = (0.04, 0.054) if girl else (0.037, 0.048)
        for sgn in (-1, 1):
            cx = sgn * ex
            blush = np.exp(-((((X - sgn * 0.172) / 0.04) ** 2 + ((Z + 0.125) / 0.022) ** 2) ** 1.3))
            put("#f79c98", blush * (0.6 if girl else 0.38))
            iris = ellipse(cx, ez, rx, rz)
            t = np.clip((Z - (ez - rz)) / (2 * rz), 0, 1)[..., None] ** 1.3
            put(srgb(colors["iris_light"]) * (1 - t) + srgb(line) * t, iris)
            pupil = np.exp(-(((X - cx) / (rx * 0.5)) ** 2 + ((Z - ez - 0.006) / (rz * 0.5)) ** 2) ** 2)
            put(line, pupil * iris * 0.75)
            # 가는 윗눈꺼풀 선: 눈동자 위를 살짝 덮습니다
            arc = [
                (cx + sgn * rx * 1.15 * math.cos(a), ez + rz * 0.18 + rz * 0.86 * math.sin(a))
                for a in np.linspace(math.radians(4), math.radians(170), 24)
            ]
            put(line, stroke(arc, 0.0105 if girl else 0.0085))
            if girl:
                ox, oz = arc[0]
                put(line, stroke([(ox, oz), (ox + sgn * 0.013, oz + 0.013)], 0.007))
            put("#ffffff", ellipse(cx - 0.014, ez + 0.02, 0.0105, 0.0125))
            put("#ffffff", ellipse(cx + 0.014, ez - 0.026, 0.005, 0.0055) * 0.85)
            bz = ez + rz + (0.04 if girl else 0.034)
            brow = [(cx + dx, bz + 0.006 * (1 - (dx / 0.028) ** 2)) for dx in np.linspace(-0.028, 0.028, 9)]
            put(colors["hair_dark"], stroke(brow, 0.0055 if girl else 0.009))
        put("#7a4030", stroke(cat_mouth(-0.128, 0.012) if girl else smile(-0.138, 0.024), 0.006))

    return np.clip(img, 0, 1)


# 얼굴 그림 한 장에 여자(왼쪽 절반)·남자(오른쪽 절반) 얼굴을 나란히 담습니다.
# 머리는 둥글어서 네모난 그림의 네 귀퉁이는 얼굴에 쓰이지 않습니다. 그 빈 귀퉁이에 "한 가지 색 칸"을 둡니다.
#  - 왼쪽 아래 칸(살색): 머리 뒤쪽·귀처럼 얼굴 그림이 필요 없는 살색 부분이 이 칸을 씁니다
#  - 왼쪽 위 칸(흰색): 옷·머리카락처럼 앱이 색을 따로 칠하는 조각이 이 칸을 씁니다 (흰색 × 칠한 색 = 칠한 색)
FACE_BLOCK = 64  # 색 칸 한 변(픽셀)
FACE_OFFSET = {"girl": 0.0, "boy": 0.5}  # 그림에서 그 얼굴이 시작하는 가로 자리 (0~1)
UV_SKIN = (FACE_BLOCK / 2 / (FACE_SIZE * 2), FACE_BLOCK / 2 / FACE_SIZE)
UV_WHITE = (FACE_BLOCK / 2 / (FACE_SIZE * 2), 1 - FACE_BLOCK / 2 / FACE_SIZE)


def make_face_atlas():
    n = FACE_SIZE
    atlas = np.concatenate([draw_face(kind, PALETTE[kind]) for kind in ("girl", "boy")], axis=1)
    atlas[:FACE_BLOCK, :FACE_BLOCK] = srgb(SKIN)  # 0번째 줄이 그림의 맨 아래
    atlas[n - FACE_BLOCK :, :FACE_BLOCK] = 1.0
    rgba = np.concatenate([atlas, np.ones((n, n * 2, 1))], axis=2).astype(np.float32)
    image = bpy.data.images.new("chibi_face", n * 2, n, alpha=False)
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = os.path.join(tempfile.gettempdir(), "chibi_face.png")
    image.file_format = "PNG"
    image.save()
    return image


# ---- 부위별 모양 -------------------------------------------------------------
def build_head(parent, kind, face_image):
    """머리(얼굴 그림 포함)와 귀"""
    bm = bmesh.new()
    add_ellipsoid(bm, (0, 0, HEAD_Z), (RX, RY, RZ), seg=40, rings=20)
    for sgn in (-1, 1):
        add_ellipsoid(bm, (sgn * RX * 0.97, 0.015, HEAD_Z - 0.035), (0.028, 0.04, 0.05), seg=12, rings=8)
    # 얼굴 그림 붙이기: 앞을 보는 면만 그림에 맞추고, 나머지는 그림 구석의 살색 한 점을 씁니다
    uv = bm.loops.layers.uv.new("UVMap")
    for face in bm.faces:
        front = face.calc_center_median().y < -0.25 * RY
        for loop in face.loops:
            co = loop.vert.co
            if front:
                # 그림의 절반(여자는 왼쪽, 남자는 오른쪽)에 맞춥니다
                loop[uv].uv = (FACE_OFFSET[kind] + (0.5 + co.x / (2 * RX)) / 2, 0.5 + (co.z - HEAD_Z) / (2 * RZ))
            else:
                loop[uv].uv = UV_SKIN
    return finish("HeadSkin", bm, make_material("Face", image=face_image), parent)


# 머리 모양 목록 (시안). 앱에는 여자 long(긴 생머리)·남자 bowl(덮은 머리)이 들어 있습니다 (11.29 사용자 확정)
HAIR_STYLES = {
    "girl": ["twin", "bob", "long", "ponytail", "bun"],
    "boy": ["part", "bowl", "crop", "center"],
}
# 이번에 만들 머리 모양: --hair-girl 이름, --hair-boy 이름 으로 바꿀 수 있습니다
HAIR = {
    "girl": ARGS[ARGS.index("--hair-girl") + 1] if "--hair-girl" in ARGS else "long",
    "boy": ARGS[ARGS.index("--hair-boy") + 1] if "--hair-boy" in ARGS else "bowl",
}


def build_hair(parent, kind, material):
    """
    머리카락: 머리보다 조금 큰 껍데기를 정수리에서 아래로 내려 그립니다.
    방향(앞·옆·뒤)마다 "어디까지 내려오는지"만 다르게 줘서 앞머리·옆머리·뒷머리를 만들고,
    묶은 머리(양 갈래·포니테일·똥머리)는 둥근 덩어리를 덧붙입니다.
    """
    style = HAIR[kind]
    seg, rows = 128, 26
    hx, hz = RX * 1.08, RZ * (1.11 if kind == "girl" else 1.15)  # 남자는 정수리를 조금 더 봉긋하게
    z_top = HEAD_Z + hz
    chin = HEAD_Z - RZ + 0.005  # 턱선 높이

    def locks(x):
        """아래가 둥근 머리카락 가닥이 나란히 놓인 모양 (0~1). 톱니처럼 뾰족하지 않고 도톰한 가닥으로 보입니다"""
        return abs(math.sin(math.pi * x))

    def end_height(phi):
        """phi = 정면에서 잰 각도. 그 방향의 머리카락 끝 높이"""
        a = abs(phi)
        turn = phi / (2 * math.pi)
        if kind == "girl":
            # 앞머리는 모두 같습니다: 도톰한 가닥 3개로 된 둥근 앞머리
            front = smooth(math.radians(68), math.radians(50), a)  # 1 = 얼굴 앞(앞머리)
            bang = HEAD_Z + 0.082 - 0.024 * locks(turn * 10.8 + 0.5) - 0.02 * (a / math.radians(50)) ** 2
            back = smooth(math.radians(75), math.radians(140), a)
            if style == "bob":  # 단발: 턱선까지
                side = chin
            elif style == "long":  # 긴 생머리: 옆은 턱 아래, 뒤는 등까지
                side = chin - 0.02 - 0.1 * smooth(math.radians(70), math.radians(125), a)
            else:  # 묶은 머리: 머리에 붙는 짧은 옆·뒷머리
                side = HEAD_Z - 0.1 - 0.07 * back
        else:
            front = smooth(math.radians(86), math.radians(64), a)
            sweep = phi / math.radians(64)  # -1 ~ 1
            back = smooth(math.radians(85), math.radians(150), a)
            side = HEAD_Z - 0.065 - 0.105 * back
            if style == "bowl":  # 덮은 머리: 눈썹 위까지 고르게 내려온 앞머리
                bang = HEAD_Z + 0.088 - 0.02 * locks(turn * 8.4 + 0.5) - 0.012 * sweep**2
            elif style == "crop":  # 짧은 머리: 이마가 드러나고 옆도 귀 위까지
                bang = HEAD_Z + 0.15 - 0.012 * locks(turn * 8.4 + 0.5) - 0.03 * sweep**2
                side = HEAD_Z + 0.02 - 0.13 * back
            elif style == "center":  # 가운데 가르마: 가운데가 높고 양옆으로 내려옴
                bang = HEAD_Z + 0.16 - 0.1 * (a / math.radians(64)) ** 0.75
            else:  # part = 옆 가르마: 한쪽으로 쓸어 넘긴 도톰한 앞머리 3가닥
                bang = HEAD_Z + 0.118 - 0.03 * locks(turn * 8.4 + 0.5) - 0.036 * sweep
        return side + (bang - side) * front

    def radius(z):
        """머리 중심보다 아래에서 껍데기가 얼마나 벌어지는지 (1 = 머리 둘레 그대로)"""
        d = HEAD_Z - z
        if style == "bob":  # 살짝 부풀었다가 끝이 안으로 말립니다
            t = min(1.0, d / (HEAD_Z - chin))
            return 1 + 0.05 * math.sin(math.pi * t) - 0.13 * t**3
        if style == "long":  # 곧게 떨어집니다
            return 1 - 0.1 * min(1.0, d / 0.33) ** 2
        return 1 - 0.13 * min(1.0, d / 0.175) ** 2  # 머리에 붙어 내려갑니다

    bm = bmesh.new()
    top = bm.verts.new((0, 0.01, z_top))
    cols = []
    for k in range(seg):
        phi = 2 * math.pi * k / seg - math.pi
        dx, dy = math.sin(phi), -math.cos(phi)
        hy = RY * (1.08 if dy < 0 else 1.13)  # 뒤통수는 조금 더 볼록하게
        z_end = end_height(phi)
        col = []
        for j in range(1, rows + 1):
            z = z_top - (z_top - z_end) * (1 - math.cos(j / rows * math.pi / 2))
            r = math.sqrt(max(0.0, 1 - ((z - HEAD_Z) / hz) ** 2)) if z >= HEAD_Z else radius(z)
            col.append(bm.verts.new((dx * hx * r, 0.01 + dy * hy * r, z)))
        cols.append(col)
    for k in range(seg):
        a, b = cols[k], cols[(k + 1) % seg]
        bm.faces.new((top, a[0], b[0]))
        for j in range(rows - 1):
            bm.faces.new((a[j], a[j + 1], b[j + 1], b[j]))
    if style == "twin":
        # 귀 뒤로 낮게 묶은 양 갈래 머리 (통통한 물방울 모양)
        for sgn in (-1, 1):
            add_ellipsoid(bm, (sgn * 0.275, 0.075, HEAD_Z - 0.15), (0.075, 0.072, 0.105), seg=20, rings=12)
    elif style == "ponytail":
        # 뒤통수 위쪽에서 묶어 아래로 늘어뜨린 머리
        add_ellipsoid(bm, (0, 0.27, HEAD_Z + 0.07), (0.06, 0.055, 0.06), seg=16, rings=10)
        add_ellipsoid(bm, (0, 0.335, HEAD_Z - 0.06), (0.078, 0.07, 0.15), seg=20, rings=12)
    elif style == "bun":
        # 정수리의 동그란 똥머리
        add_ellipsoid(bm, (0, 0.06, z_top + 0.035), (0.1, 0.095, 0.08), seg=20, rings=12)
    obj = finish("Hair", bm, material, parent)
    # 종이처럼 얇지 않게 안쪽으로 두께를 줍니다
    solid = obj.modifiers.new("Thickness", "SOLIDIFY")
    solid.thickness = 0.03
    solid.offset = -1
    solid.use_rim_only = True  # 안쪽 면은 머리에 가려 보이지 않으므로 테두리만 만듭니다 (그릴 점이 절반)
    return obj


# ---- 옷 (꾸미기 5부위: 상의·하의·장갑·목도리·신발) -------------------------------
# 부위마다 고를 수 있는 모양과 색입니다. (디자인 시안, 11.28)
DEFAULT_OUTFIT = {
    "girl": dict(top="cardigan", bottom="skirt", gloves="none", scarf="none", shoes="loafer"),
    "boy": dict(top="cardigan", bottom="shorts", gloves="none", scarf="none", shoes="loafer"),
}
ITEM_COLORS = {
    "sweater": "#d4453e", "sweater_band": "#fbf3e4",
    "puffer": "#3f7f62", "fur": "#fbf3e4",
    "hoodie": "#8f88cc", "santa": "#c9302c", "belt": "#2a2a2e", "buckle": "#f0c24a",
    "pants": "#6b5a4a",
    "mitten": "#d4453e", "knit": "#f0c24a",
    "scarf": "#d4453e",
    "boots": "#8a5a3c", "sneaker": "#d4453e", "sole": "#fbfbfb",
}


# 고를 수 있는 색 (11.28 사용자 확정: 모든 옷·액세서리는 색을 고를 수 있음). 다섯 부위가 같은 색 목록을 씁니다
COLORS = {
    "red": "#d4453e", "pink": "#f4b9c1", "yellow": "#e9b53c", "green": "#3f7f62", "sky": "#a9c3e6",
    "navy": "#2f3f6b", "purple": "#8f88cc", "brown": "#8a5a3c", "cream": "#f6ecd9", "black": "#2b2b31",
}
# 재질 이름 → 그 재질의 색을 정하는 부위 (예: 운동화 몸통 색은 신발 색을 따릅니다. 털·밑창·줄무늬는 늘 흰색)
COLOR_PART = {
    "top": "top", "bottom": "bottom", "mitten": "gloves", "knit": "gloves",
    "scarf": "scarf", "shoe": "shoes", "boots": "shoes", "sneaker": "shoes",
}


def puffer_profile():
    """패딩 점퍼 옆모습 선: 가로 누빔 때문에 올록볼록합니다"""
    pts = [(0.125, 0.186)]
    for i in range(25):
        t = i / 24
        z = 0.192 + (0.43 - 0.192) * t
        r = 0.17 + (0.126 - 0.17) * t**1.6 + 0.011 * abs(math.sin(math.pi * 4 * t))
        pts.append((r, z))
    return pts + [(0.08, 0.455), (0.045, 0.462)]


def add_ring(bm, radius, z, tube, sy=1.0, seg=32, squash=1.0):
    """도넛 모양 고리 (목도리, 털 깃)"""
    circle = [
        (radius + tube * math.cos(a), z + tube * squash * math.sin(a))
        for a in np.linspace(-math.pi / 2, 1.5 * math.pi, 13)
    ]
    add_lathe(bm, circle, seg=seg, sy=sy, cap_bottom=False, cap_top=False)


def build_torso(parent, kind, mats, outfit):
    """목·상의·옷깃·리본/넥타이·단추·목도리·하의(허리 쪽)"""
    girl = kind == "girl"
    top = outfit["top"]
    profile = puffer_profile() if top == "puffer" else TOP_PROFILE

    def front_y(z, extra=0.0):
        return -(profile_radius(profile, z) * TORSO_DEPTH + extra)

    bm = bmesh.new()
    add_lathe(bm, [(0.05, 0.42), (0.05, 0.50)], seg=16)
    finish("Neck", bm, mats("skin"), parent)

    bm = bmesh.new()
    add_lathe(bm, profile, seg=40, sy=TORSO_DEPTH)
    finish("Top", bm, mats("top"), parent)

    if top == "cardigan":
        # 옷깃: 목을 두르는 띠. 앞쪽 양옆이 뾰족하게 내려옵니다
        def collar_mod(a, i):
            if i > 0:
                return 1.0
            front = max(0.0, -math.sin(a))  # 앞(-Y)일수록 1
            return 1 + 0.32 * front**3 * abs(math.cos(a)) * 2.2

        bm = bmesh.new()
        add_lathe(bm, [(0.108, 0.424), (0.088, 0.444), (0.06, 0.462)], seg=32, sy=0.86, mod=collar_mod, cap_bottom=False, cap_top=False)
        collar = finish("Collar", bm, mats("collar"), parent)
        thick = collar.modifiers.new("Thickness", "SOLIDIFY")
        thick.thickness = 0.008

        bm = bmesh.new()
        if girl:
            # 리본: 매듭 + 양쪽 고리 + 아래로 늘어진 끈
            z = 0.426
            y = front_y(z, 0.012)
            add_ellipsoid(bm, (0, y - 0.004, z), (0.014, 0.012, 0.014), seg=10, rings=8)
            for sgn in (-1, 1):
                add_ellipsoid(bm, (sgn * 0.038, y, z + 0.004), (0.032, 0.011, 0.021), seg=14, rings=8)
                add_ellipsoid(bm, (sgn * 0.016, y - 0.002, z - 0.03), (0.011, 0.008, 0.026), seg=10, rings=8)
            finish("Ribbon", bm, mats("accent"), parent)
        else:
            # 넥타이: 매듭 + 길쭉한 몸
            add_ellipsoid(bm, (0, front_y(0.432, 0.008), 0.432), (0.016, 0.011, 0.014), seg=10, rings=8)
            add_ellipsoid(bm, (0, front_y(0.388, 0.002), 0.388), (0.02, 0.009, 0.04), seg=12, rings=10)
            finish("Tie", bm, mats("accent"), parent)

        bm = bmesh.new()
        for z in (0.3, 0.342, 0.384) if girl else (0.275, 0.31):
            add_ellipsoid(bm, (0, front_y(z, -0.002), z), (0.011, 0.008, 0.011), seg=10, rings=6)
        finish("Buttons", bm, mats("button"), parent)

    elif top == "sweater":
        # 니트 스웨터: 도톰한 목둘레 + 가슴의 흰 줄무늬 띠
        bm = bmesh.new()
        add_ring(bm, 0.076, 0.452, 0.02, sy=0.9)
        finish("TopNeck", bm, mats("top"), parent)
        bm = bmesh.new()
        band = [(profile_radius(profile, z) + 0.004, z) for z in (0.318, 0.326, 0.35, 0.374, 0.382)]
        band[0] = (band[0][0] - 0.006, band[0][1])
        band[-1] = (band[-1][0] - 0.006, band[-1][1])
        add_lathe(bm, band, seg=40, sy=TORSO_DEPTH, cap_bottom=False, cap_top=False)
        finish("TopBand", bm, mats("sweater_band"), parent)

    elif top == "hoodie":
        # 후드티: 도톰한 목둘레 + 등 뒤로 넘긴 모자 + 앞주머니 + 흰 끈 두 줄
        bm = bmesh.new()
        add_ring(bm, 0.084, 0.45, 0.024, sy=0.9)
        add_ellipsoid(bm, (0, 0.085, 0.425), (0.11, 0.06, 0.065), seg=18, rings=12)  # 넘긴 모자
        add_ellipsoid(bm, (0, front_y(0.295, -0.002), 0.295), (0.075, 0.014, 0.034), seg=16, rings=8)  # 앞주머니
        finish("TopHood", bm, mats("top"), parent)
        bm = bmesh.new()
        for sgn in (-1, 1):
            add_ellipsoid(bm, (sgn * 0.03, front_y(0.385, 0.003), 0.385), (0.0055, 0.0055, 0.034), seg=8, rings=8)
            add_ellipsoid(bm, (sgn * 0.03, front_y(0.35, 0.004), 0.35), (0.009, 0.008, 0.009), seg=8, rings=6)
        finish("TopString", bm, mats("fur"), parent)

    elif top == "santa":
        # 산타 옷: 흰 털 깃·밑단·앞섶 + 검은 허리띠와 금색 버클
        def band(z0, z1, extra):
            zs = [z0, z0 + 0.005, (z0 + z1) / 2, z1 - 0.005, z1]
            pts = [(profile_radius(profile, z) + extra, z) for z in zs]
            pts[0] = (pts[0][0] - extra, z0)
            pts[-1] = (pts[-1][0] - extra, z1)
            return pts

        bm = bmesh.new()
        add_ring(bm, 0.09, 0.446, 0.026, sy=0.9)
        add_lathe(bm, band(0.236, 0.272, 0.01), seg=40, sy=TORSO_DEPTH, cap_bottom=False, cap_top=False)
        add_ellipsoid(bm, (0, front_y(0.37, -0.004), 0.37), (0.017, 0.012, 0.06), seg=10, rings=10)  # 앞섶
        finish("TopFur", bm, mats("fur"), parent)
        bm = bmesh.new()
        add_lathe(bm, band(0.288, 0.316, 0.005), seg=40, sy=TORSO_DEPTH, cap_bottom=False, cap_top=False)
        finish("TopBelt", bm, mats("belt"), parent)
        bm = bmesh.new()
        add_ellipsoid(bm, (0, front_y(0.302, 0.004), 0.302), (0.024, 0.01, 0.02), seg=10, rings=8)
        finish("TopBuckle", bm, mats("buckle"), parent)

    else:
        # 패딩 점퍼: 복슬복슬한 털 깃 + 앞 단추 두 개
        bm = bmesh.new()
        add_ring(bm, 0.092, 0.446, 0.027, sy=0.9)
        finish("TopFur", bm, mats("fur"), parent)
        bm = bmesh.new()
        for z in (0.36, 0.29):
            add_ellipsoid(bm, (0, front_y(z, -0.002), z), (0.013, 0.009, 0.013), seg=10, rings=6)
        finish("Buttons", bm, mats("button"), parent)

    # 목도리 (11.28 한 가지로 확정): 턱 밑을 덮는 두툼한 고리 + 옆쪽 매듭에서 앞으로 늘어진 납작한 자락 하나.
    # 자락 끝에는 흰 줄무늬 두 줄과 술이 있습니다
    scarf = outfit["scarf"]
    if scarf != "none":
        bm = bmesh.new()
        stripe = bmesh.new()

        def tail(x, y, z_top, length, tilt):
            """납작한 자락 하나 + 끝의 줄무늬 두 줄 + 술. tilt만큼 좌우로 기울어집니다"""
            half = length / 2
            zc = z_top - half
            c, sn = math.cos(tilt), math.sin(tilt)

            def at(lx, d):
                # 자락 가운데에서 옆으로 lx, 자락 방향으로 d만큼 떨어진 자리
                return (x + lx * c + d * sn, y, zc - lx * sn + d * c)

            add_slab(bm, (x, y, zc), (0.04, 0.012, half), tilt)
            for dz in (0.03, 0.052):
                add_slab(stripe, at(0, -half + dz), (0.0415, 0.0135, 0.0065), tilt)
            for k in range(4):
                add_ellipsoid(stripe, at((k - 1.5) * 0.02, -half - 0.008), (0.006, 0.006, 0.016), seg=8, rings=6)

        add_ring(bm, 0.114, 0.442, 0.042, sy=0.92, squash=0.82)
        y = front_y(0.36, 0.022)
        add_ellipsoid(bm, (0.078, y + 0.012, 0.425), (0.04, 0.026, 0.034), seg=12, rings=8)  # 매듭
        tail(0.08, y, 0.425, 0.15, math.radians(-5))
        finish("Scarf", bm, mats("scarf"), parent)
        finish("ScarfStripe", stripe, mats("fur"), parent)

    bottom = outfit["bottom"]
    bm = bmesh.new()
    if bottom == "skirt":
        # 주름치마: 밑단으로 갈수록 주름이 깊어집니다
        weight = [1.0, 0.6, 0.15, 0.0]
        add_lathe(
            bm,
            [(0.182, 0.15), (0.168, 0.185), (0.15, 0.225), (0.135, 0.25)],
            seg=72,
            sy=0.84,
            mod=lambda a, i: 1 + 0.04 * weight[i] * tri(a / (2 * math.pi) * 18),
        )
    else:
        # 바지의 허리 부분 (가랑이 아래 자락은 다리와 함께 움직이도록 다리 쪽에 있습니다)
        add_lathe(bm, [(0.118, 0.172), (0.142, 0.19), (0.146, 0.25)], seg=32, sy=0.8)
    finish("Bottom", bm, mats("bottom"), parent)


def build_arm(root, side, mats, outfit):
    """팔: 차렷 자세(아래로 뻗음)로 만든 뒤 옆으로 벌려 둡니다. 앱에서는 ArmL·ArmR 노드를 돌려 흔듭니다"""
    sgn = 1 if side == "L" else -1  # 캐릭터의 왼쪽이 +X
    pivot = add_pivot(f"Arm{side}", (sgn * SHOULDER[0], SHOULDER[1], SHOULDER[2]), root)
    rest = add_pivot(f"Arm{side}_Rest", (0, 0, 0), pivot)
    rest.rotation_euler = (0, -sgn * ARM_SPREAD, 0)
    top = outfit["top"]

    bm = bmesh.new()
    if top == "puffer":
        sleeve = [(0.044, -0.172), (0.05, -0.166), (0.05, -0.15)]
        sleeve += [(0.058 + 0.01 * abs(math.sin(math.pi * 3 * t)), -0.145 + 0.125 * t) for t in np.linspace(0, 1, 16)]
        sleeve += [(0.03, 0.012)]
    else:
        sleeve = [
            (0.044, -0.172), (0.05, -0.166), (0.05, -0.146),  # 소매 끝 고무단
            (0.059, -0.138), (0.063, -0.085), (0.054, -0.025), (0.03, 0.012),
        ]
    add_lathe(bm, sleeve, seg=20)
    finish(f"Arm{side}_Sleeve", bm, mats("top"), rest, local=True)
    if top == "santa":
        # 산타 옷은 소매 끝에도 흰 털
        bm = bmesh.new()
        add_lathe(bm, [(0.046, -0.176), (0.058, -0.17), (0.058, -0.142), (0.05, -0.136)], seg=20)
        finish(f"Arm{side}_Fur", bm, mats("fur"), rest, local=True)
    if top == "sweater":
        bm = bmesh.new()
        add_lathe(bm, [(0.058, -0.118), (0.066, -0.112), (0.067, -0.082), (0.058, -0.076)], seg=20, cap_bottom=False, cap_top=False)
        finish(f"Arm{side}_Band", bm, mats("sweater_band"), rest, local=True)

    gloves = outfit["gloves"]
    bm = bmesh.new()
    if gloves == "none":
        add_ellipsoid(bm, (0, 0, -0.19), (0.036, 0.031, 0.04), seg=14, rings=10)
        finish(f"Arm{side}_Hand", bm, mats("skin"), rest, local=True)
        return
    # 장갑: 손보다 조금 큰 벙어리 모양 + 엄지 + 손목단
    add_ellipsoid(bm, (0, 0, -0.2), (0.044, 0.037, 0.048), seg=14, rings=10)
    add_ellipsoid(bm, (0, -0.032, -0.19), (0.017, 0.019, 0.022), seg=10, rings=8)
    if gloves == "knit":
        add_lathe(bm, [(0.046, -0.176), (0.051, -0.172), (0.051, -0.158), (0.046, -0.154)], seg=18)
    finish(f"Arm{side}_Glove", bm, mats(gloves), rest, local=True)
    if gloves == "mitten":
        bm = bmesh.new()
        add_lathe(bm, [(0.046, -0.184), (0.057, -0.178), (0.057, -0.156), (0.046, -0.15)], seg=18)
        finish(f"Arm{side}_GloveFur", bm, mats("fur"), rest, local=True)


def build_leg(root, side, mats, outfit):
    """다리·양말·신발. 앱에서는 LegL·LegR 노드를 돌려 걷게 합니다"""
    sgn = 1 if side == "L" else -1
    x = sgn * HIP[0]
    pivot = add_pivot(f"Leg{side}", (x, HIP[1], HIP[2]), root)
    bottom, shoes = outfit["bottom"], outfit["shoes"]

    bm = bmesh.new()
    add_lathe(bm, [(0.046, 0.03), (0.05, 0.1), (0.054, 0.225)], seg=18, cx=x)
    finish(f"Leg{side}_Skin", bm, mats("skin"), pivot)

    sock_top = 0.118 if bottom == "skirt" else 0.088
    bm = bmesh.new()
    add_lathe(bm, [(0.052, 0.03), (0.056, sock_top - 0.01), (0.057, sock_top), (0.05, sock_top + 0.002)], seg=18, cx=x)
    finish(f"Leg{side}_Sock", bm, mats("sock"), pivot)

    bm = bmesh.new()
    if shoes == "loafer":
        add_ellipsoid(bm, (x, -0.022, 0.03), (0.06, 0.088, 0.04), seg=18, rings=12, min_z=0.0)
        finish(f"Leg{side}_Shoe", bm, mats("shoe"), pivot)
    elif shoes == "boots":
        # 털 부츠: 발 + 발목 위로 올라오는 통 + 위쪽 털 테두리
        add_ellipsoid(bm, (x, -0.024, 0.032), (0.064, 0.092, 0.044), seg=18, rings=12, min_z=0.0)
        add_lathe(bm, [(0.06, 0.03), (0.063, 0.1)], seg=18, cx=x)
        finish(f"Leg{side}_Shoe", bm, mats("boots"), pivot)
        bm = bmesh.new()
        add_lathe(bm, [(0.058, 0.082), (0.073, 0.088), (0.073, 0.112), (0.056, 0.118)], seg=18, cx=x)
        finish(f"Leg{side}_ShoeFur", bm, mats("fur"), pivot)
    else:
        # 운동화: 색 있는 몸 + 흰 밑창
        add_ellipsoid(bm, (x, -0.022, 0.036), (0.058, 0.086, 0.04), seg=18, rings=12, min_z=0.012)
        finish(f"Leg{side}_Shoe", bm, mats("sneaker"), pivot)
        bm = bmesh.new()
        add_ellipsoid(bm, (x, -0.024, 0.016), (0.063, 0.093, 0.022), seg=18, rings=10, min_z=0.0)
        finish(f"Leg{side}_ShoeSole", bm, mats("sole"), pivot)

    if bottom != "skirt":
        low = 0.118 if bottom == "shorts" else 0.052  # 반바지는 무릎 위, 긴바지는 발목까지
        bm = bmesh.new()
        add_lathe(bm, [(0.064, low), (0.068, low + 0.008), (0.068, 0.2), (0.05, 0.225)], seg=20, cx=x)
        finish(f"Leg{side}_Bottom", bm, mats("bottom"), pivot)


def build_character(kind, outfit=None):
    colors = PALETTE[kind]
    outfit = {**DEFAULT_OUTFIT[kind], **(outfit or {})}
    base = {
        "skin": (SKIN, 0.85), "hair": (colors["hair"], 0.7), "collar": (colors["collar"], 0.85),
        "accent": (colors["accent"], 0.85), "sock": (colors["sock"], 0.85),
        "shoe": (colors["shoe"], 0.45), "button": (colors["button"], 0.5),
        # 상의·하의 색은 고른 모양에 따라 달라집니다 (가디건·치마·반바지는 캐릭터 기본색)
        "top": (ITEM_COLORS.get(outfit["top"], colors["top"]), 0.85),
        "bottom": (ITEM_COLORS.get(outfit["bottom"], colors["bottom"]), 0.85),
    }
    cache = {}

    def mats(key):
        """이름으로 재질을 꺼냅니다 (처음 쓸 때 한 번만 만듭니다)"""
        if key not in cache:
            hex_color, rough = base.get(key) or (ITEM_COLORS[key], 0.85)
            # 색을 따로 골랐으면(예: top_color="red") 그 색을 씁니다
            picked = outfit.get(COLOR_PART.get(key, "") + "_color")
            if picked:
                hex_color = COLORS[picked]
            cache[key] = make_material(key.capitalize() + "Color", hex_color, rough=rough)
            # 앱용 묶음 파일을 만들 때 쓰는 꼬리표: 색을 고르는 부위면 "part:부위", 아니면 정해진 색
            cache[key]["tag"] = "part:" + COLOR_PART[key] if key in COLOR_PART else hex_color
        return cache[key]

    root = add_pivot("Chibi", (0, 0, 0))
    head = add_pivot("Head", (0, 0, NECK_Z), root)
    torso = add_pivot("Torso", (0, 0, 0), root)
    build_head(head, kind, make_face_atlas())
    build_hair(head, kind, mats("hair"))
    build_torso(torso, kind, mats, outfit)
    for side in ("L", "R"):
        build_arm(root, side, mats, outfit)
        build_leg(root, side, mats, outfit)


# ---- 미리보기 그림 -----------------------------------------------------------
def render_previews(prefix, views=("front", "quarter", "side", "back"), size=(600, 760), target=None, ortho=1.3):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = linear("#efe6d6")
    bg.inputs["Strength"].default_value = 0.9
    scene.world = world

    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 2.6
    sun.data.angle = math.radians(20)
    bpy.context.collection.objects.link(sun)

    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    target = Vector((0, 0, 0.47)) if target is None else target
    for name, deg in (("front", 0), ("quarter", 35), ("side", 90), ("back", 180)):
        if name not in views:
            continue
        a = math.radians(deg)
        direction = Vector((math.sin(a), -math.cos(a), 0.12)).normalized()
        cam.location = target + direction * 4
        cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
        # 해는 늘 카메라의 왼쪽 위에서 비춥니다
        light_dir = Vector((math.sin(a - 0.6), -math.cos(a - 0.6), 0.9)).normalized()
        sun.rotation_euler = light_dir.to_track_quat("Z", "Y").to_euler()
        scene.render.filepath = f"{prefix}_{name}.png"
        bpy.ops.render.render(write_still=True)


# ---- 앱용 묶음 파일 (--kit) ---------------------------------------------------
# 앱은 캐릭터 파일 하나(chibi.glb)만 받습니다. 그 안에 여자·남자 머리와 모든 옷 모양이 조각조각 들어 있고,
# 조각마다 꼬리표가 붙어 있습니다. 앱은 주민이 고른 옷에 맞는 조각만 골라 색을 칠해 한 덩어리로 합칩니다.
#   when  : 이 조각을 쓰는 조건. 예) "base=girl" / "top=santa" / "scarf=muffler;top=puffer" / ""(항상)
#   color : "part:top"(상의 색을 따름) 또는 "#rrggbb"(정해진 색). 얼굴은 그림을 그대로 쓰므로 "#ffffff"
#   limb  : 걸을 때 흔드는 부위 번호. 0 = 몸·머리(고정), 1 = 왼팔, 2 = 오른팔, 3 = 왼다리, 4 = 오른다리
LIMBS = {"ArmL": 1, "ArmR": 2, "LegL": 3, "LegR": 4}


def depends_on(name):
    """조각 이름 → 그 조각의 모양을 정하는 것들"""
    if name in ("HeadSkin", "Hair"):
        return ("base",)
    if name == "Neck" or name.endswith("_Skin"):
        return ()
    if name in ("Ribbon", "Tie", "Buttons"):
        return ("base", "top")
    if name.startswith("Scarf"):
        return ("scarf", "top")  # 상의가 두꺼우면(패딩) 목도리 자락이 그만큼 앞으로 나옵니다
    if name.endswith("_Hand") or "_Glove" in name:
        return ("gloves",)
    if "_Shoe" in name:
        return ("shoes",)
    if name == "Bottom" or name.endswith(("_Bottom", "_Sock")):
        return ("bottom",)
    if name.startswith("Top") or name == "Collar" or name.endswith(("_Sleeve", "_Band", "_Fur")):
        return ("top",)
    raise ValueError(f"꼬리표를 모르는 조각: {name}")


def build_kit(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kit_material = make_material("Chibi", image=make_face_atlas())
    seen = set()
    kept = []
    count = 0
    for kind in ("girl", "boy"):
        for top in CATALOG["top"]:
            for scarf in CATALOG["scarf"]:
                # 하의·장갑·신발은 돌아가며 한 번씩만 만들어지면 됩니다
                outfit = dict(
                    top=top, scarf=scarf,
                    bottom=CATALOG["bottom"][count % 3],
                    gloves=CATALOG["gloves"][count % 3],
                    shoes=CATALOG["shoes"][count % 3],
                )
                count += 1
                build_character(kind, outfit)
                bpy.context.view_layer.update()
                graph = bpy.context.evaluated_depsgraph_get()
                values = {"base": kind, **outfit}
                fresh = [o for o in bpy.data.objects if not o.get("kit")]
                for obj in fresh:
                    if obj.type != "MESH":
                        continue
                    when = ";".join(f"{d}={values[d]}" for d in depends_on(obj.name))
                    key = (obj.name, when)
                    if key in seen:
                        continue
                    seen.add(key)
                    # 두께 같은 꾸밈을 실제 모양으로 굳히고, 자리·회전도 모양에 구워 넣습니다
                    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(graph))
                    mesh.transform(obj.matrix_world)
                    if obj.name != "HeadSkin":
                        layer = mesh.uv_layers[0] if mesh.uv_layers else mesh.uv_layers.new(name="UVMap")
                        for item in layer.data:
                            item.uv = UV_WHITE
                    tag = "#ffffff" if obj.name == "HeadSkin" else obj.data.materials[0]["tag"]
                    mesh.materials.clear()
                    mesh.materials.append(kit_material)
                    piece = bpy.data.objects.new(f"{obj.name}@{when}"[:60], mesh)
                    piece["kit"] = 1
                    piece["when"] = when
                    piece["color"] = tag
                    piece["limb"] = LIMBS.get(obj.name[:4], 0)
                    kept.append(piece)
                for obj in fresh:
                    bpy.data.objects.remove(obj, do_unlink=True)
    for piece in kept:
        bpy.context.collection.objects.link(piece)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_extras=True)
    tris = sum(len(p.data.loop_triangles) or sum(len(f.vertices) - 2 for f in p.data.polygons) for p in kept)
    print(f"저장: {path} ({os.path.getsize(path) / 1024:.0f} KB, 조각 {len(kept)}개, 세모 {tris}개)")


# ---- 옷 카드 그림 (--thumbs) --------------------------------------------------
def build_thumbs(folder):
    """꾸미기 창의 옷 카드용 그림: 캐릭터를 만든 뒤 그 부위의 조각만 남기고 투명 바탕으로 찍습니다"""
    os.makedirs(folder, exist_ok=True)
    for part, items in CATALOG.items():
        for item in items:
            if item == "none":
                continue
            for color in COLORS:
                bpy.ops.wm.read_factory_settings(use_empty=True)
                build_character("girl", {part: item, part + "_color": color})
                for obj in list(bpy.data.objects):
                    if obj.type != "MESH":
                        continue
                    keep = part in depends_on(obj.name) and not obj.name.endswith("_Sock")
                    if part == "gloves" and not obj.name.startswith("ArmL"):
                        keep = False  # 장갑은 한 짝만 크게 보여 줍니다
                    if not keep:
                        bpy.data.objects.remove(obj, do_unlink=True)
                bpy.context.view_layer.update()
                # 남은 조각을 모두 감싸는 상자를 구해, 그 가운데를 보고 꽉 차게 찍습니다
                points = [o.matrix_world @ Vector(c) for o in bpy.data.objects if o.type == "MESH" for c in o.bound_box]
                low = Vector([min(p[i] for p in points) for i in range(3)])
                high = Vector([max(p[i] for p in points) for i in range(3)])
                scene = bpy.context.scene
                scene.render.film_transparent = True
                render_previews(
                    os.path.join(folder, f"{part}_{item}_{color}"),
                    views=("quarter",),
                    size=(192, 192),
                    target=(low + high) / 2,
                    ortho=max(high - low) * 1.1,
                )


# ---- 실행 --------------------------------------------------------------------
if "--hairs" in ARGS:
    # 머리 모양 시안: 모양마다 앞·비스듬히·옆·뒤 모습을 뽑습니다
    hair_dir = os.path.abspath(ARGS[ARGS.index("--hairs") + 1])
    os.makedirs(hair_dir, exist_ok=True)
    for hair_kind, hair_styles in HAIR_STYLES.items():
        for hair_style in hair_styles:
            HAIR[hair_kind] = hair_style
            bpy.ops.wm.read_factory_settings(use_empty=True)
            build_character(hair_kind)
            render_previews(os.path.join(hair_dir, f"{hair_kind}_{hair_style}"))
elif THUMB_DIR:
    build_thumbs(os.path.abspath(THUMB_DIR))
elif KIT_PATH:
    build_kit(os.path.abspath(KIT_PATH))
elif COLOR_DIR:
    # 색 시안: 모든 모양에 색을 하나씩 바꿔 입힌 그림을 뽑습니다 (모양 14개 × 색 10가지)
    os.makedirs(COLOR_DIR, exist_ok=True)
    for part, items in CATALOG.items():
        for item in items:
            if item == "none":
                continue
            for color in COLORS:
                prefix = os.path.join(COLOR_DIR, f"{part}_{item}_{color}")
                if os.path.exists(prefix + "_quarter.png"):
                    continue  # 이미 뽑은 그림은 건너뜁니다
                bpy.ops.wm.read_factory_settings(use_empty=True)
                build_character("girl", {part: item, part + "_color": color})
                render_previews(prefix, views=("quarter",))
    for i, (kind, outfit) in enumerate(COLOR_COMBOS):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        build_character(kind, outfit)
        render_previews(os.path.join(COLOR_DIR, f"combo_{i}"), views=("quarter",))
elif CATALOG_DIR:
    # 디자인 시안: 부위마다 모양을 하나씩만 바꿔 입힌 그림을 뽑습니다 (모델 파일은 만들지 않습니다)
    os.makedirs(CATALOG_DIR, exist_ok=True)
    shots = [("girl", part, item) for part, items in CATALOG.items() for item in items]
    for kind, part, item in shots:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        build_character(kind, {part: item})
        render_previews(os.path.join(CATALOG_DIR, f"{part}_{item}"), views=("quarter",))
    for i, (kind, outfit) in enumerate(COMBOS):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        build_character(kind, outfit)
        render_previews(os.path.join(CATALOG_DIR, f"combo_{i}"), views=("quarter",))
else:
    for kind in ("girl", "boy"):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        build_character(kind)
        out = os.path.abspath(os.path.join(OUT_DIR, f"chibi_{kind}.glb"))
        bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_yup=True, export_apply=True)
        print(f"저장: {out} ({os.path.getsize(out) / 1024:.0f} KB)")
        if PREVIEW_DIR:
            os.makedirs(PREVIEW_DIR, exist_ok=True)
            render_previews(os.path.join(PREVIEW_DIR, kind))

# Blender로 대왕 트리(전나무)를 만드는 스크립트입니다. (11.25 사용자 요청: 지금 트리보다 조금 더 사실적인 느낌)
#
# 실행 방법 (터미널):
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/make_fir.py -- public/models/handmade/fir.glb
#   (숲용: 눈 얹은 가벼운 버전)
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/make_fir.py -- public/models/handmade/fir_snow.glb --snow --lite
#
# 옵션
#   --snow : 가지 윗면에 눈을 얹습니다 (마을 바깥 숲 나무용)
#   --lite : 가지 층·마디 수를 줄인 가벼운 버전 (숲처럼 여러 그루를 세울 때 휴대폰 부담을 줄임)
#
# 만드는 방식
#  - 줄기: 위로 갈수록 가늘어지는 원기둥
#  - 가지 (대왕 트리, 11.26 사용자 요청: 더 전나무(fir)답게):
#      가지 하나는 "지붕처럼 가운데가 솟은 길쭉한 판"이고, 그 위에 전나무 가지 그림을 입힙니다.
#      그림(scripts/blender/fir_branch.png)은 잔가지마다 바늘잎이 빽빽한 모습이며,
#      scripts/blender/make_fir_branch_texture.py가 코드로 그립니다. 투명한 부분은 앱에서 잘라 냅니다.
#      (세모 조각으로 잎을 만들면 바늘잎이 아니라 넓적한 잎처럼 보여서 이 방식으로 바꿨습니다)
#      층층이 돌려나고, 아래로 처졌다가 끝이 살짝 들립니다. 아래층은 길게 처지고 위층은 위를 향합니다.
#      가지 사이로 줄기가 훤히 비치지 않게 안쪽에 짙은 속심(원뿔)을 넣었습니다.
#  - 가지 (숲 나무 --lite): 예전 방식인 넓은 "잎 날개" (가볍고, 눈을 얹기 좋음)
#  - 색: 줄기 가까운 안쪽은 짙은 초록, 가지 끝은 밝은 초록 (꼭짓점 색으로 칠함 → 텍스처 그림 파일이 필요 없음)
#  - 장식은 하나도 없습니다 (장식은 앱이 진행률에 따라 코드로 답니다)
#
# 숫자(높이·층 수·가지 수 등)를 바꾸고 다시 실행하면 모양을 쉽게 다듬을 수 있습니다.
# random.seed가 고정이라 같은 숫자면 항상 같은 나무가 나옵니다.

import math
import random
import sys

import bmesh
import bpy
from mathutils import Vector

# ---- 옵션 읽기 ("--" 뒤에 오는 값들) ---------------------------------------
ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
SNOW = "--snow" in ARGS
LITE = "--lite" in ARGS

# ---- 모양 설정 -------------------------------------------------------------
SEED = 1225
HEIGHT = 2.0  # 나무 전체 높이 (앱에서 약 15.4로 키웁니다)
BASE_RADIUS = 0.68  # 맨 아래 가지가 뻗는 길이
TIERS = 23  # 가지 층 수
FIRST_TIER = 0.11  # 첫 가지 층이 붙는 높이 비율 (아래는 줄기만 보임)
SEGMENTS = 7  # 가지 하나를 몇 마디로 나눌지 (클수록 부드럽지만 무거움)
BRANCHES = (13, 6)  # 한 층의 가지 수 (맨 아래, 맨 위)
# 가지 모양: spray = 잔가지가 깃털처럼 달린 전나무 가지 / wing = 넓은 잎 날개(예전 방식, 숲 나무용)
STYLE = "wing" if LITE else "spray"
if STYLE == "spray":
    SEGMENTS = 5  # 가지 판은 그림이 모양을 만들어 주므로 마디가 적어도 됩니다
if LITE:
    TIERS, SEGMENTS, BRANCHES, BASE_RADIUS = 11, 4, (9, 5), 0.72

# 색 (선형 색공간 값. 화면에서는 조금 더 밝게 보입니다)
INNER = (0.030, 0.120, 0.045)  # 안쪽 짙은 초록
TIP = (0.130, 0.380, 0.095)  # 가지 끝 밝은 초록
if STYLE == "spray":
    # 전나무는 노란빛이 적은 짙은 청록색입니다. 새로 자란 가지 끝만 조금 밝습니다
    INNER = (0.020, 0.085, 0.048)
    TIP = (0.105, 0.340, 0.150)
    # 가지 판은 그림이 색을 갖고 있어서, 꼭짓점 색은 "밝기"로만 씁니다 (안쪽은 그늘지게, 끝은 그림 색 그대로)
    SHADE = (0.62, 1.0)
BARK = (0.090, 0.045, 0.022, 1.0)  # 줄기 갈색
SNOW_COLOR = (0.82, 0.87, 0.93, 1.0)  # 눈 (살짝 푸른 흰색)

random.seed(SEED)

# ---- 장면 비우기 -----------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)


def lerp(a, b, t):
    return a + (b - a) * t


def mix_color(t, jitter):
    """t=0 안쪽, t=1 끝. jitter로 가지마다 색을 조금씩 다르게"""
    return tuple(max(0.0, lerp(INNER[k], TIP[k], t) * jitter) for k in range(3)) + (1.0,)


# ---- 잎(가지) 메시 ---------------------------------------------------------
leaves_mesh = bpy.data.meshes.new("FirLeaves")
bm = bmesh.new()
color_layer = bm.loops.layers.color.new("Col")
uv_layer = bm.loops.layers.uv.new("UVMap")  # 가지 그림을 어디에 입힐지 (전나무 가지 판에서만 씀)


def add_branch(base_z, angle, length, droop, rise, width, jitter):
    """줄기의 높이 base_z에서 angle 방향으로 뻗는 잎 날개 하나를 만듭니다."""
    direction = Vector((math.cos(angle), math.sin(angle), 0.0))
    side = Vector((-math.sin(angle), math.cos(angle), 0.0))
    left, center, right = [], [], []
    spines, widths = [], []
    for i in range(SEGMENTS + 1):
        s = i / SEGMENTS
        horiz = length * s
        # 처음엔 조금 위로 뻗다가(rise) 끝으로 갈수록 아래로 처짐(droop)
        z = base_z + rise * horiz - droop * length * (s ** 2.0)
        spine = direction * horiz + Vector((0, 0, z))
        # 폭: 줄기 쪽은 좁고, 1/3 지점에서 가장 넓고, 끝은 뾰족
        w = width * min(1.0, s * 3.5 + 0.15) * (1.0 - s) ** 0.75
        # 톱니: 마디마다 번갈아 가장자리를 들쭉날쭉하게 (바늘잎 덩어리 느낌)
        w *= 1.0 + (0.28 if i % 2 else -0.12)
        ridge = Vector((0, 0, w * 0.32))  # 가운데 등뼈는 조금 솟게
        sag = Vector((0, 0, -w * 0.22))  # 양 가장자리는 조금 처지게
        spines.append(spine)
        widths.append(w)
        center.append(bm.verts.new(spine + ridge))
        left.append(bm.verts.new(spine + side * w + sag))
        right.append(bm.verts.new(spine - side * w + sag))
    faces = []
    for i in range(SEGMENTS):
        faces.append((bm.faces.new((left[i], left[i + 1], center[i + 1], center[i])), i))
        faces.append((bm.faces.new((center[i], center[i + 1], right[i + 1], right[i])), i))
    # 꼭짓점 색: 마디 위치에 따라 안쪽→끝 그라데이션
    for face, i in faces:
        for loop in face.loops:
            vi = None
            for arr in (left, center, right):
                if loop.vert in arr:
                    vi = arr.index(loop.vert)
                    break
            t = (vi or 0) / SEGMENTS
            loop[color_layer] = mix_color(t ** 0.8, jitter)
    if SNOW:
        add_snow(spines, widths, side)


def add_spray(base_z, angle, length, droop, rise, curl, width, jitter):
    """전나무 가지 하나: 가운데가 솟고 양옆이 처진 길쭉한 판에 가지 그림을 입힙니다.

    - droop: 끝으로 갈수록 아래로 처지는 정도 / rise: 처음에 위로 뻗는 정도 / curl: 끝이 다시 들리는 정도
    - width: 판의 반 폭. 그림 속 잔가지가 이 폭까지 뻗습니다
    """
    direction = Vector((math.cos(angle), math.sin(angle), 0.0))
    side = Vector((-math.sin(angle), math.cos(angle), 0.0))
    up = Vector((0, 0, 1))
    rows = []  # 마디마다 (왼쪽, 가운데, 오른쪽) 꼭짓점
    for i in range(SEGMENTS + 1):
        s = i / SEGMENTS
        horiz = length * s
        z = base_z + rise * horiz - droop * length * (s ** 1.6) + curl * length * (s ** 4)
        spine = direction * horiz + up * z
        # 지붕 모양 단면: 가운데 등뼈는 솟고, 잔가지 끝(양 가장자리)은 아래로 처집니다 → 옆에서 봐도 면이 보입니다
        ridge = up * (width * 0.16)
        sag = up * (-width * 0.34)
        rows.append(
            (
                bm.verts.new(spine + side * width + sag),
                bm.verts.new(spine + ridge),
                bm.verts.new(spine - side * width + sag),
            )
        )
    for i in range(SEGMENTS):
        for col in (0, 1):
            quad = (rows[i][col], rows[i + 1][col], rows[i + 1][col + 1], rows[i][col + 1])
            face = bm.faces.new(quad)
            corners = ((col, i), (col, i + 1), (col + 1, i + 1), (col + 1, i))
            for loop, (c, r) in zip(face.loops, corners):
                v = r / SEGMENTS
                # 그림에서 u = 가로(0 왼쪽 ~ 1 오른쪽), v = 세로(0 줄기 쪽 ~ 1 가지 끝)
                loop[uv_layer].uv = (c / 2.0, v)
                shade = lerp(SHADE[0], SHADE[1], v ** 0.7) * jitter
                loop[color_layer] = (shade * 0.94, shade, shade * 0.9, 1.0)


# 속심과 꼭대기 새순처럼 "그림 없이 색만 칠하는 덩어리"가 들어갈 곳.
# 전나무 가지 판(spray)일 때는 잎과 재질이 달라서 따로 모으고, 잎 날개(wing)일 때는 잎과 함께 둡니다.
solid_bm = bmesh.new() if STYLE == "spray" else bm
solid_color = solid_bm.loops.layers.color.new("Col") if STYLE == "spray" else color_layer


def add_core():
    """가지 사이로 줄기가 훤히 비치지 않게 넣는 짙은 속심 (울퉁불퉁한 원뿔)"""
    SIDES, RINGS = 12, 9
    rings = []
    for j in range(RINGS + 1):
        f = j / RINGS
        t = lerp(FIRST_TIER + 0.02, 0.9, f)
        r = (BASE_RADIUS * (1.0 - t) ** 0.92) * 0.46 + 0.012
        ring = []
        for i in range(SIDES):
            a = i * math.tau / SIDES + (0.26 if j % 2 else 0.0)
            rr = r * random.uniform(0.86, 1.1)
            ring.append(solid_bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, t * HEIGHT)))
        rings.append(ring)
    for j in range(RINGS):
        for i in range(SIDES):
            face = solid_bm.faces.new((rings[j][i], rings[j][(i + 1) % SIDES], rings[j + 1][(i + 1) % SIDES], rings[j + 1][i]))
            for loop in face.loops:
                # 속심은 가지 그늘과 비슷한 짙은 초록 (너무 검으면 층 사이가 구멍처럼 보입니다)
                # 💡 속심은 가지에 가려 빛을 거의 못 받아 화면에서는 이 값보다 훨씬 어둡게 보입니다. 그래서 밝은 값을 줍니다
                loop[solid_color] = (0.10, 0.27, 0.16, 1.0)


def add_snow(spines, widths, side):
    """가지 윗면(줄기 쪽~끝 조금 전)에 울퉁불퉁한 눈 덩어리 띠를 얹습니다."""
    mid, lft, rgt = [], [], []
    last = max(1, SEGMENTS - 1)  # 가지 끝 마디는 초록으로 남김
    for i in range(1, last + 1):
        w = widths[i]
        cover = random.uniform(0.55, 0.85)  # 눈이 덮는 폭 (마디마다 다르게 → 자연스러움)
        lift = Vector((0, 0, w * 0.12 + 0.012))  # 잎 표면보다 살짝 위
        top = Vector((0, 0, w * 0.32)) + lift * 1.6  # 가운데는 소복하게 더 높이
        # 가장자리 높이: 잎 표면(가운데 +0.32w → 가장자리 -0.22w)의 cover 지점 높이 + 살짝 위
        edge = Vector((0, 0, (0.32 - 0.54 * cover) * w)) + lift
        mid.append(bm.verts.new(spines[i] + top))
        lft.append(bm.verts.new(spines[i] + side * w * cover + edge))
        rgt.append(bm.verts.new(spines[i] - side * w * cover + edge))
    for i in range(len(mid) - 1):
        for quad in ((lft[i], lft[i + 1], mid[i + 1], mid[i]), (mid[i], mid[i + 1], rgt[i + 1], rgt[i])):
            face = bm.faces.new(quad)
            for loop in face.loops:
                loop[color_layer] = SNOW_COLOR


# 높이별로 가장 멀리 뻗은 잎의 반지름을 적어 둡니다 (앱의 장식 자리표 TREE_MODELS.profile을 만들 때 씀)
if STYLE == "spray":
    add_core()

for k in range(TIERS):
    f = k / (TIERS - 1)
    t = lerp(FIRST_TIER, 0.93, f)  # 이 층이 붙는 높이 비율
    base_z = t * HEIGHT
    # 위로 갈수록 가지가 짧아지는 원뿔 윤곽 (+ 약간의 들쭉날쭉)
    envelope = BASE_RADIUS * (1.0 - t) ** 0.92 + 0.05
    count = int(round(lerp(BRANCHES[0], BRANCHES[1], f)))
    offset = random.uniform(0, math.tau)
    if STYLE == "spray":
        # 전나무: 한 층(돌려나기)에 긴 가지들 + 그 사이사이에 짧은 속가지
        for b in range(count):
            angle = offset + b * math.tau / count + random.uniform(-0.12, 0.12)
            length = envelope * random.uniform(0.88, 1.06)
            # 아래층은 수평으로 뻗어 길게 처지고, 위층은 위를 향해 뻗습니다. 끝은 모두 살짝 들립니다
            droop = lerp(0.46, 0.10, f ** 0.8) * random.uniform(0.85, 1.15)
            rise = lerp(0.10, 0.85, f ** 1.3)
            curl = lerp(0.16, 0.05, f)
            width = 0.04 + 0.40 * length  # 판의 반 폭
            add_spray(base_z, angle, length, droop, rise, curl, width, random.uniform(0.74, 1.1))
            # 속가지 1: 반 칸 어긋난 방향, 조금 위에서, 더 짧고 더 위를 향하게 (긴 가지 사이를 채움)
            add_spray(
                base_z + 0.018,
                angle + math.pi / count,
                length * random.uniform(0.62, 0.76),
                droop * 0.6,
                rise + 0.2,
                curl,
                0.04 + 0.40 * length * 0.72,
                random.uniform(0.68, 0.86),
            )
            # 속가지 2: 더 짧고 더 위를 향한 가지 (줄기 둘레를 채워 안쪽이 비어 보이지 않게)
            add_spray(
                base_z + 0.03,
                angle + math.pi / count * 0.5,
                length * random.uniform(0.36, 0.46),
                droop * 0.3,
                rise + 0.5,
                curl,
                0.04 + 0.40 * length * 0.5,
                random.uniform(0.58, 0.72),
            )
        continue
    for b in range(count):
        angle = offset + b * math.tau / count + random.uniform(-0.25, 0.25)
        length = envelope * random.uniform(0.82, 1.08)
        droop = random.uniform(0.32, 0.5) * (1.0 - 0.4 * f)
        rise = lerp(0.18, 0.55, f)  # 위쪽 가지일수록 위를 향함
        width = 0.06 + 0.24 * length
        jitter = random.uniform(0.8, 1.2)
        add_branch(base_z, angle, length, droop, rise, width, jitter)

if STYLE == "spray":
    # 모양표 출력: 높이 비율마다, 그 높이 근처 잎 꼭짓점 중 바깥쪽 85% 지점의 반지름
    bm.verts.ensure_lookup_table()
    leaf_verts = [v.co for v in bm.verts]
    rows = []
    for t in (0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95):
        radii = sorted(math.hypot(c.x, c.y) for c in leaf_verts if abs(c.z / HEIGHT - t) < 0.05)
        if radii:
            rows.append(f"[{t}, {radii[int(len(radii) * 0.85)]:.2f}]")
    print("[make_fir] profile: " + ", ".join(rows))

# 꼭대기 새순: 위로 곧게 선 작은 뾰족 원뿔
top_ring = []
TOP_SIDES = 6
for i in range(TOP_SIDES):
    a = i * math.tau / TOP_SIDES
    top_r = 0.026 if STYLE == "spray" else 0.045  # 전나무는 꼭대기 새순이 가늘고 곧습니다
    top_z = HEIGHT * (0.86 if STYLE == "spray" else 0.9)
    top_ring.append(solid_bm.verts.new((math.cos(a) * top_r, math.sin(a) * top_r, top_z)))
apex = solid_bm.verts.new((0, 0, HEIGHT))
for i in range(TOP_SIDES):
    face = solid_bm.faces.new((top_ring[i], top_ring[(i + 1) % TOP_SIDES], apex))
    for loop in face.loops:
        if SNOW and loop.vert is apex:
            loop[solid_color] = SNOW_COLOR  # 꼭대기에도 눈
        else:
            loop[solid_color] = mix_color(1.0 if loop.vert is apex else 0.6, 1.0)

bm.to_mesh(leaves_mesh)
bm.free()
for poly in leaves_mesh.polygons:
    poly.use_smooth = True

# 잎 재질: 꼭짓점 색(Col)을 그대로 색으로 씀, 양면 보이기, 금속감 없음
leaf_mat = bpy.data.materials.new("FirLeaves")
leaf_mat.use_nodes = True
leaf_mat.use_backface_culling = False
nodes = leaf_mat.node_tree.nodes
bsdf = nodes["Principled BSDF"]
bsdf.inputs["Metallic"].default_value = 0.0
bsdf.inputs["Roughness"].default_value = 0.9
if STYLE == "spray":
    # 가지 그림을 색으로 쓰고, 그림의 투명한 부분은 잘라 냅니다 (꼭짓점 색은 내보낼 때 함께 담겨 앱에서 곱해집니다)
    import os

    image = bpy.data.images.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), "fir_branch.png"))
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    leaf_mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    leaf_mat.node_tree.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    leaf_mat.blend_method = "CLIP"
    leaf_mat.alpha_threshold = 0.5
else:
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    leaf_mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
leaves_mesh.materials.append(leaf_mat)

leaves = bpy.data.objects.new("FirLeaves", leaves_mesh)
bpy.context.collection.objects.link(leaves)
parts = [leaves]

if STYLE == "spray":
    # 속심 + 꼭대기 새순: 그림 없이 꼭짓점 색만 쓰는 재질
    solid_mesh = bpy.data.meshes.new("FirCore")
    solid_bm.to_mesh(solid_mesh)
    solid_bm.free()
    for poly in solid_mesh.polygons:
        poly.use_smooth = True
    solid_mat = bpy.data.materials.new("FirCore")
    solid_mat.use_nodes = True
    solid_bsdf = solid_mat.node_tree.nodes["Principled BSDF"]
    solid_bsdf.inputs["Metallic"].default_value = 0.0
    solid_bsdf.inputs["Roughness"].default_value = 0.95
    solid_attr = solid_mat.node_tree.nodes.new("ShaderNodeVertexColor")
    solid_attr.layer_name = "Col"
    solid_mat.node_tree.links.new(solid_attr.outputs["Color"], solid_bsdf.inputs["Base Color"])
    solid_mesh.materials.append(solid_mat)
    solid = bpy.data.objects.new("FirCore", solid_mesh)
    bpy.context.collection.objects.link(solid)
    parts.append(solid)

# ---- 줄기 ------------------------------------------------------------------
# (bpy.ops 대신 bmesh로 만들어, 창을 띄운 Blender와 백그라운드 실행 모두에서 똑같이 동작하게 합니다)
trunk_mesh = bpy.data.meshes.new("FirTrunk")
tbm = bmesh.new()
bmesh.ops.create_cone(
    tbm, cap_ends=True, cap_tris=False, segments=10, radius1=0.075, radius2=0.012, depth=HEIGHT * 0.92
)
bmesh.ops.translate(tbm, verts=tbm.verts, vec=(0, 0, HEIGHT * 0.46))
tbm.to_mesh(trunk_mesh)
tbm.free()
for poly in trunk_mesh.polygons:
    poly.use_smooth = True
trunk = bpy.data.objects.new("FirTrunk", trunk_mesh)
bpy.context.collection.objects.link(trunk)
bark_mat = bpy.data.materials.new("FirBark")
bark_mat.use_nodes = True
bark_bsdf = bark_mat.node_tree.nodes["Principled BSDF"]
bark_bsdf.inputs["Base Color"].default_value = BARK
bark_bsdf.inputs["Metallic"].default_value = 0.0
bark_bsdf.inputs["Roughness"].default_value = 0.95
trunk.data.materials.append(bark_mat)

# ---- 내보내기 ---------------------------------------------------------------
tris = sum(len(p.vertices) - 2 for o in (*parts, trunk) for p in o.data.polygons)

if bpy.app.background:
    # 터미널(--background)로 실행했을 때만 glb 파일로 저장합니다
    out = next((a for a in ARGS if not a.startswith("--")), "fir.glb")
    kwargs = dict(filepath=out, export_format="GLB", export_yup=True, export_apply=True)
    try:
        bpy.ops.export_scene.gltf(export_vertex_color="ACTIVE", **kwargs)
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)
    print(f"[make_fir] saved {out}  triangles≈{tris}")
else:
    # Blender 창으로 열었을 때는 저장하지 않고 장면에 나무만 만들어 둡니다 (직접 보고 고치기용)
    print(f"[make_fir] built in Blender window  triangles≈{tris}")

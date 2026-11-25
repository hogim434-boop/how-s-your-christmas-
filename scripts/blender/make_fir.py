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
#  - 가지: 줄기에서 여러 층(tier)으로 사방에 뻗는 "잎 날개". 끝이 살짝 처지고, 가장자리는 톱니 모양(바늘잎 느낌)
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
BASE_RADIUS = 0.72  # 맨 아래 가지가 뻗는 길이
TIERS = 20  # 가지 층 수
FIRST_TIER = 0.11  # 첫 가지 층이 붙는 높이 비율 (아래는 줄기만 보임)
SEGMENTS = 7  # 가지 하나를 몇 마디로 나눌지 (클수록 부드럽지만 무거움)
BRANCHES = (13, 7)  # 한 층의 가지 수 (맨 아래, 맨 위)
if LITE:
    TIERS, SEGMENTS, BRANCHES = 11, 4, (9, 5)

# 색 (선형 색공간 값. 화면에서는 조금 더 밝게 보입니다)
INNER = (0.030, 0.120, 0.045)  # 안쪽 짙은 초록
TIP = (0.130, 0.380, 0.095)  # 가지 끝 밝은 초록
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


for k in range(TIERS):
    f = k / (TIERS - 1)
    t = lerp(FIRST_TIER, 0.93, f)  # 이 층이 붙는 높이 비율
    base_z = t * HEIGHT
    # 위로 갈수록 가지가 짧아지는 원뿔 윤곽 (+ 약간의 들쭉날쭉)
    envelope = BASE_RADIUS * (1.0 - t) ** 0.92 + 0.05
    count = int(round(lerp(BRANCHES[0], BRANCHES[1], f)))
    offset = random.uniform(0, math.tau)
    for b in range(count):
        angle = offset + b * math.tau / count + random.uniform(-0.25, 0.25)
        length = envelope * random.uniform(0.82, 1.08)
        droop = random.uniform(0.32, 0.5) * (1.0 - 0.4 * f)
        rise = lerp(0.18, 0.55, f)  # 위쪽 가지일수록 위를 향함
        width = 0.06 + 0.24 * length
        jitter = random.uniform(0.8, 1.2)
        add_branch(base_z, angle, length, droop, rise, width, jitter)

# 꼭대기 새순: 위로 곧게 선 작은 뾰족 원뿔
top_ring = []
TOP_SIDES = 6
for i in range(TOP_SIDES):
    a = i * math.tau / TOP_SIDES
    top_ring.append(bm.verts.new((math.cos(a) * 0.045, math.sin(a) * 0.045, HEIGHT * 0.9)))
apex = bm.verts.new((0, 0, HEIGHT))
for i in range(TOP_SIDES):
    face = bm.faces.new((top_ring[i], top_ring[(i + 1) % TOP_SIDES], apex))
    for loop in face.loops:
        if SNOW and loop.vert is apex:
            loop[color_layer] = SNOW_COLOR  # 꼭대기에도 눈
        else:
            loop[color_layer] = mix_color(1.0 if loop.vert is apex else 0.6, 1.0)

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
attr = nodes.new("ShaderNodeVertexColor")
attr.layer_name = "Col"
leaf_mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
leaves_mesh.materials.append(leaf_mat)

leaves = bpy.data.objects.new("FirLeaves", leaves_mesh)
bpy.context.collection.objects.link(leaves)

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
tris = sum(len(p.vertices) - 2 for o in (leaves, trunk) for p in o.data.polygons)

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

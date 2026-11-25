# your-day 캐릭터 시안 1 — 편지 배달 가방을 멘 꼬마
# 실행: /Applications/Blender.app/Contents/MacOS/Blender --background --python build_character.py
# 결과: character.glb(웹용), character.blend(블렌더 파일), preview_*.png(미리보기)
import bpy
import math
import os
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))

# ---------- 장면 초기화 ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def make_mat(name, hex_color, rough=0.7):
    """색상 코드(#RRGGBB)로 무광 재질을 만든다"""
    h = hex_color.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    # 블렌더는 선형 색공간을 쓰므로 sRGB 값을 변환
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*lin, 1)
    bsdf.inputs["Roughness"].default_value = rough
    return m


# 차분한 미니어처 색감
M = {
    "skin": make_mat("Skin", "#F2C8AC"),
    "hair": make_mat("Hair", "#4E3629", 0.45),  # 나중에 꾸미기로 바꿀 색(살짝 윤기)
    "hair_light": make_mat("HairLight", "#5E4232", 0.45),  # 결 차이를 주는 밝은 가닥
    "hair_base": make_mat("HairBase", "#3A281F", 0.6),  # 안쪽 바탕(어둡게)
    "coat": make_mat("Coat", "#6F8FA6"),
    "scarf": make_mat("Scarf", "#C4574F"),
    "boots": make_mat("Boots", "#6B4A35"),
    "bag": make_mat("Bag", "#B98A5A"),
    "letter": make_mat("Letter", "#F3EAD7"),
    "seal": make_mat("Seal", "#C4574F", 0.4),
    "eye": make_mat("Eye", "#2B211D", 0.3),
    "white": make_mat("EyeShine", "#FFFFFF", 0.2),
    "blush": make_mat("Blush", "#F2A3A0"),
    "button": make_mat("Button", "#E8D9B5", 0.5),
}

parts = []


def finish(obj, name, mat, smooth=True):
    obj.name = name
    obj.data.materials.append(mat)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    parts.append(obj)
    return obj


def sphere(name, loc, scale, mat, rot=(0, 0, 0), seg=40, ring=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=1, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    o.rotation_euler = rot
    return finish(o, name, mat)


def apply_mods(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


# ---------- 머리 ----------
HC = Vector((0, 0, 0.80))  # 머리 중심
HR = Vector((0.28, 0.27, 0.26))  # 머리 반지름(x, 앞뒤 y, 위아래 z)
head = sphere("Head", HC, HR, M["skin"])


def on_face(x, dz, inset=0.0):
    """얼굴 표면 위 한 점과 그 지점의 바깥 방향(법선)을 구한다. 캐릭터는 -Y 방향을 본다"""
    t = 1 - (x / HR.x) ** 2 - (dz / HR.z) ** 2
    y = -HR.y * math.sqrt(max(t, 0))
    p = Vector((x, y, HC.z + dz))
    n = Vector((x / HR.x ** 2, y / HR.y ** 2, dz / HR.z ** 2)).normalized()
    return p - n * inset, n


def face_part(name, x, dz, scale, mat, inset=0.004):
    p, n = on_face(x, dz, inset)
    o = sphere(name, p, scale, mat, seg=24, ring=12)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = n.to_track_quat("-Y", "Z")  # 얼굴 곡면을 따라 눕힘
    return o


# 눈(세로로 긴 동그란 눈) + 반짝이
for s in (-1, 1):
    face_part(f"Eye_{'L' if s < 0 else 'R'}", s * 0.10, -0.03, (0.030, 0.014, 0.042), M["eye"])
    p, n = on_face(s * 0.10 + 0.010, -0.010, -0.010)
    sphere(f"EyeShine_{'L' if s < 0 else 'R'}", p, (0.011, 0.011, 0.011), M["white"], seg=16, ring=8)
    face_part(f"Blush_{'L' if s < 0 else 'R'}", s * 0.165, -0.095, (0.042, 0.010, 0.026), M["blush"])
face_part("Mouth", 0, -0.105, (0.016, 0.008, 0.010), M["eye"])

# ---------- 머리카락 — 바탕(두피 가림) + 가닥 다발 ----------
import random
random.seed(7)  # 매번 같은 모양이 나오도록 고정
HAIR_C = HC + Vector((0, 0.018, 0.03))  # 머리카락 중심
HAIR_R = Vector((0.29, 0.285, 0.272))   # 바탕 머리 반지름

# 1) 바탕: 다발 사이로 피부가 보이지 않게 어두운 안쪽 머리
hair = sphere("Hair", HAIR_C, HAIR_R, M["hair_base"], seg=48, ring=24)
cutters = []
bpy.ops.mesh.primitive_cube_add(location=(0, -0.30, HC.z + 0.05 - 0.4))  # 얼굴 드러내기
c1 = bpy.context.active_object
c1.scale = (0.5, 0.25, 0.4)
bpy.ops.mesh.primitive_cube_add(location=(0, 0, HC.z - 0.12 - 0.5))  # 단발 길이
c2 = bpy.context.active_object
c2.scale = (0.6, 0.6, 0.5)
for c in (c1, c2):
    mod = hair.modifiers.new("cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = c
    cutters.append(c)
apply_mods(hair)
for c in cutters:
    bpy.data.objects.remove(c)


def hair_pt(phi, e, k):
    """머리 표면 위 점. phi=정면(0)에서 돈 각도, e=높이 각도, k=표면에서 띄우는 정도"""
    return HAIR_C + Vector((HAIR_R.x * k * math.cos(e) * math.sin(phi),
                            -HAIR_R.y * k * math.cos(e) * math.cos(phi),
                            HAIR_R.z * k * math.sin(e)))


def lock(phi_deg, e_end_deg, width, mat, k_out=1.07):
    """정수리에서 시작해 두피를 따라 흘러내리는 머리 다발 하나(끝은 가늘고 안으로 말림)"""
    phi = math.radians(phi_deg)
    e0 = math.radians(80 + random.uniform(-4, 4))
    e1 = math.radians(e_end_deg)
    n = 7
    pts, radii = [], [0.55, 0.9, 1.0, 1.0, 0.92, 0.65, 0.18]
    for i in range(n):
        t = i / (n - 1)
        e = e0 + (e1 - e0) * t
        k = 1.0 + (k_out - 1.0) * math.sin(math.pi * min(t / 0.85, 1.0))  # 가운데는 부풀고 끝은 안으로
        if i == n - 1:
            k = 0.99
        pts.append(hair_pt(phi + math.radians(random.uniform(-1.5, 1.5)) * t, e, k))
    cu = bpy.data.curves.new("lock", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = width
    cu.bevel_resolution = 3
    cu.resolution_u = 6
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(n - 1)
    for bp, p, r in zip(sp.bezier_points, pts, radii):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
        bp.radius = r
    ob = bpy.data.objects.new("Lock", cu)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


locks = []
for i in range(34):
    phi_deg = -180 + i * (360 / 34) + random.uniform(-3, 3)
    a = abs(phi_deg)
    if a <= 42:      # 앞머리: 이마 위에서 끝남
        e_end = 2 + random.uniform(-2, 2)
    elif a <= 72:    # 옆머리: 볼을 감싸며 점점 길어짐
        e_end = 2 - (a - 42) / 30 * 36
    else:            # 뒷머리: 단발 길이
        e_end = -36 + random.uniform(-3, 3)
    mat = M["hair"] if i % 2 == 0 else M["hair_light"]
    locks.append(lock(phi_deg, e_end, 0.05 + random.uniform(-0.004, 0.006), mat))
# 정수리 볼륨을 위한 짧은 윗층 다발
for i in range(12):
    phi_deg = i * 30 + 15
    a = abs(((phi_deg + 180) % 360) - 180)
    e_end = 25 if a > 42 else 18
    locks.append(lock(phi_deg, e_end, 0.045, M["hair_light"] if i % 2 else M["hair"], k_out=1.11))

# 곡선 다발을 모델(메시)로 바꾸고 바탕 머리와 하나로 합침 → 웹에서도 그대로 보임
bpy.ops.object.select_all(action="DESELECT")
for l in locks:
    l.select_set(True)
bpy.context.view_layer.objects.active = locks[0]
bpy.ops.object.convert(target="MESH")
hair.select_set(True)
bpy.context.view_layer.objects.active = hair
bpy.ops.object.join()
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
hair.select_set(False)

# ---------- 몸(코트) ----------
sphere("Body", (0, 0, 0.36), (0.21, 0.19, 0.24), M["coat"])
for i, z in enumerate((0.40, 0.29)):
    sphere(f"Button{i}", (0, -0.188, z), (0.018, 0.010, 0.018), M["button"], seg=16, ring=8)

# 목도리 + 늘어진 끝자락
bpy.ops.mesh.primitive_torus_add(major_radius=0.15, minor_radius=0.05, location=(0, 0, 0.565),
                                 major_segments=40, minor_segments=16)
scarf = bpy.context.active_object
scarf.scale = (1, 1, 0.85)
finish(scarf, "Scarf", M["scarf"])
sphere("ScarfTail", (0.08, -0.17, 0.46), (0.045, 0.028, 0.10), M["scarf"], rot=(0.15, 0, -0.25))

# 팔 + 벙어리장갑
for s in (-1, 1):
    side = "L" if s < 0 else "R"
    sphere(f"Arm_{side}", (s * 0.235, 0, 0.385), (0.052, 0.052, 0.12), M["coat"], rot=(0, -s * math.radians(26), 0))
    sphere(f"Mitten_{side}", (s * 0.285, 0, 0.27), (0.055, 0.055, 0.055), M["scarf"])

# 다리 + 장화
for s in (-1, 1):
    side = "L" if s < 0 else "R"
    sphere(f"Leg_{side}", (s * 0.085, 0, 0.13), (0.058, 0.058, 0.09), M["coat"])
    sphere(f"Boot_{side}", (s * 0.085, -0.02, 0.05), (0.072, 0.095, 0.05), M["boots"])

# ---------- 우리만의 포인트: 편지 배달 가방 ----------
# 어깨끈(몸을 대각선으로 가로지름)
bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.013, location=(0, 0, 0.36),
                                 major_segments=48, minor_segments=10)
strap = bpy.context.active_object
strap.rotation_euler = (0, math.radians(-40), 0)
strap.scale = (1.14, 1.0, 1)
finish(strap, "BagStrap", M["bag"])

# 가방 몸통(둥근 상자)
bpy.ops.mesh.primitive_cube_add(location=(0.17, -0.13, 0.25))
bag = bpy.context.active_object
bag.scale = (0.085, 0.04, 0.07)
bag.rotation_euler = (0, 0, math.radians(35))
bev = bag.modifiers.new("round", "BEVEL")
bev.width = 0.025
bev.segments = 4
bpy.context.view_layer.objects.active = bag
bpy.ops.object.transform_apply(scale=True)
apply_mods(bag)
finish(bag, "Bag", M["bag"])
bag.select_set(True)
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
bag.select_set(False)

# 가방 밖으로 삐죽 나온 편지 봉투 + 빨간 하트 대신 동그란 봉인
bpy.ops.mesh.primitive_cube_add(location=(0.165, -0.125, 0.33))
env = bpy.context.active_object
env.scale = (0.06, 0.006, 0.045)
env.rotation_euler = (0, math.radians(8), math.radians(35))
finish(env, "Letter", M["letter"], smooth=False)
bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=0.012, location=(0.195, -0.17, 0.25),
                                    rotation=(math.radians(90), 0, math.radians(35)), vertices=24)
finish(bpy.context.active_object, "Seal", M["seal"])

# ---------- 하나로 묶기 ----------
bpy.ops.object.empty_add(location=(0, 0, 0))
root = bpy.context.active_object
root.name = "YourDayCharacter"
for p in parts:
    p.parent = root

# ---------- 미리보기 렌더 ----------
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.80, 0.78, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6

bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
ground = bpy.context.active_object
ground.name = "Ground"
ground.data.materials.append(make_mat("Ground", "#EDE6DC", 0.9))

bpy.ops.object.light_add(type="SUN", location=(2, -2, 4))
sun = bpy.context.active_object
sun.data.energy = 3.0
sun.data.angle = math.radians(15)  # 부드러운 그림자
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
bpy.ops.object.light_add(type="AREA", location=(-2, -2, 1.5))
fill = bpy.context.active_object
fill.data.energy = 120
fill.data.size = 3
fill.rotation_euler = (math.radians(60), 0, math.radians(-45))

bpy.ops.object.empty_add(location=(0, 0, 0.5))
target = bpy.context.active_object
bpy.ops.object.camera_add()
cam = bpy.context.active_object
cam.data.lens = 85
con = cam.constraints.new("TRACK_TO")
con.target = target
scene.camera = cam

try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 900
scene.render.resolution_y = 1000
scene.view_settings.view_transform = "AgX"

views = {
    "front": (0, -4.2, 1.1),
    "three_quarter": (2.6, -3.3, 1.3),
    "back": (-1.8, 3.8, 1.2),
}
for name, loc in views.items():
    cam.location = loc
    scene.render.filepath = os.path.join(OUT, f"preview_{name}.png")
    bpy.ops.render.render(write_still=True)

# ---------- 저장 / 내보내기 ----------
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "character.blend"))
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for p in parts:
    p.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "character.glb"), export_format="GLB",
                          use_selection=True, export_apply=True)
print("DONE")

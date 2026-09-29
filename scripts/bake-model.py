# Затенение и развёртка модели v1 для сайта.
# Вход: scripts/out/fabbit_v1_raw.glb (scripts/export-model.py). Выход: scripts/out/fabbit_v1_baked.glb с UV
# (его сжимает scripts/optimize-model.mjs) и public/models/fabbit_ao.webp (Cycles AO 2048², серый, одна развёртка).
# Запуск: blender -b --python scripts/bake-model.py
#     или в открытом Blender (MCP, консоль): ROOT = '/путь/к/fabbit-site'; exec(open(ROOT + '/scripts/bake-model.py').read())
# Скрипт очищает текущую сцену: запускайте в пустом файле.
import os, time
import bpy

ROOT = globals().get('ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'scripts', 'out', 'fabbit_v1_raw.glb')
OUT = os.path.join(ROOT, 'public', 'models')
TMP = os.path.join(ROOT, 'scripts', 'out')

# сцену чистим вручную: read_factory_settings выгрузил бы аддоны, в том числе сервер MCP
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
    for d in list(coll):
        if d.users == 0:
            coll.remove(d)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
print('meshes', len(meshes))

# одна развёртка на все детали
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.002, scale_to_bounds=False)
bpy.ops.uv.pack_islands(margin=0.002)
bpy.ops.object.mode_set(mode='OBJECT')

# общий материал с активным узлом изображения: в него пишет запекание
img = bpy.data.images.new('fabbit_ao', 2048, 2048, alpha=False)
mat = bpy.data.materials.new('bake')
mat.use_nodes = True
n = mat.node_tree.nodes.new('ShaderNodeTexImage')
n.image = img
mat.node_tree.nodes.active = n
for o in meshes:
    o.data.materials.clear()
    o.data.materials.append(mat)

sc = bpy.context.scene
try:
    sc.render.engine = 'CYCLES'
except TypeError as e:
    print(e)
sc.cycles.device = 'CPU'
sc.cycles.samples = 64
sc.world = bpy.data.worlds.new('w')
sc.world.light_settings.distance = 7.0      # мм: затенение в масштабе кнопок, пазов и микросхем
t = time.time()
bpy.ops.object.bake(type='AO', margin=8, use_clear=True)
print('bake s', round(time.time() - t, 1))
# WebP вместо PNG: затенение серое, цветность почти ничего не весит, файл в разы меньше
img.file_format = 'WEBP'
# печём в 2048² для чистых краёв, отдаём 1024²: затенение плавное, а файл и память GPU вчетверо меньше
img.scale(1024, 1024)
img.save(filepath=os.path.join(OUT, 'fabbit_ao.webp'), quality=86)

# имена узлов «Группа__материал» сохраняются; материалы сайт назначает сам
bpy.ops.export_scene.gltf(filepath=os.path.join(TMP, 'fabbit_v1_baked.glb'), use_selection=True, export_yup=True,
                          export_cameras=False, export_lights=False, export_materials='PLACEHOLDER')
print('done', OUT)

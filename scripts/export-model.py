# Модель прибора v1 для сайта: корпус из FreeCAD + покупные детали по реальным размерам.
# Запуск: freecadcmd "$PWD/scripts/export-model.py"   (FreeCAD 1.x, выход — scripts/out/fabbit_v1_raw.glb)
#
# Корпус, стекло, колпачки, колесо, выключатель и платы берутся из ~/fabbit/hardware/case/fabbit_v1.FCStd
# (его строит build_case_v1.py). Габаритные коробки покупных деталей заменяются моделями: модуль i9+
# с Artix-7, SO-DIMM, ESP32-C3-MINI, SMA, HDMI, USB-C, microSD, аккумулятор, кнопки, гребёнки.
# Главная плата и мезонин остаются гладкими: они ещё в разводке.
#
# Узлы GLB называются «Группа__материал». Группа задаёт разлёт и выноски, материал — вид (src/scene.js).
# Оси FreeCAD: X ширина, Y толщина (0 — лицо, + к спинке), Z высота. В glTF: x = X, y = Z, z = −Y.
import json, math, os, struct, sys

import FreeCAD as App
import Part

V = App.Vector
SRC = os.path.expanduser('~/fabbit/hardware/case/fabbit_v1.FCStd')
HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.path.join(os.getcwd(), 'scripts')
OUT = os.path.join(HERE, 'out', 'fabbit_v1_raw.glb')   # дальше bake-model.py: развёртка, затенение, public/models
TOL = 0.04          # мм, отклонение хорды при тесселяции


def box(x0, x1, y0, y1, z0, z1):
    return Part.makeBox(x1 - x0, y1 - y0, z1 - z0, V(x0, y0, z0))


def cyl_y(x, z, r, y0, y1):
    return Part.makeCylinder(r, y1 - y0, V(x, y0, z), V(0, 1, 0))


def cyl_z(x, y, r, z0, z1):
    return Part.makeCylinder(r, z1 - z0, V(x, y, z0), V(0, 0, 1))



def comp(shapes):
    return Part.makeCompound([s for s in shapes if s is not None])


# ── сборка: группа → материал → формы ───────────────
parts = {}


def put(group, mat, shape):
    parts.setdefault((group, mat), []).append(shape)


doc = App.openDocument(SRC)
obj = {o.Name: o for o in doc.Objects}
S = lambda n: obj[n].Shape.copy()

# корпус и детали на нём — как есть
put('Shell_Front', 'shell', S('Shell_Front'))
put('Shell_Back', 'shell', S('Shell_Back'))
put('Lid', 'shell', S('Lid'))
put('Panel', 'panel', S('Panel'))
put('Screen', 'ink', S('Screen'))
put('Caps', 'shell', S('Cap_DPad'))
for k in ('F1', 'F2', 'F3', 'F4', 'Fn', 'Menu', 'Back'):
    put('Caps', 'shell', S(f'Cap_{k}'))
put('Power', 'shell', S('Power'))
put('PCB', 'blank', S('PCB_Main'))            # наши платы серые: они ещё в разводке
put('Mezz', 'blank', S('PCB_Mezz'))

# колесо с накаткой
w = S('Wheel')
wc, wr = V(-41.3, 0, 116.0), 6.0
for k in range(36):
    a = k * 2 * math.pi / 36
    g = box(-0.35, 0.35, 4.0, 8.0, wr - 0.45, wr + 0.5)
    g.rotate(V(0, 0, 0), V(0, 1, 0), -math.degrees(a))
    g.translate(V(wc.x, 0, wc.z))
    w = w.cut(g)
put('Wheel', 'shell', w)

# ── модуль Colorlight i9+ (XC7A50T) в угловом SO-DIMM ─
Y_I9 = (11.5, 12.5)                 # плата модуля, компоненты к спинке (Y > 12.5)
i9 = box(-33.8, 33.8, *Y_I9, 55.0, 85.0)
i9 = i9.cut(box(-12.1, -10.9, Y_I9[0] - 0.1, Y_I9[1] + 0.1, 54.9, 58.0))        # ключ разъёма
for sx in (-1, 1):                                                              # полукруглые вырезы защёлок
    i9 = i9.cut(cyl_y(sx * 33.8, 80.0, 1.0, Y_I9[0] - 0.1, Y_I9[1] + 0.1))
put('I9', 'pcb', i9)
gold = []
for k in range(100):                                                           # ламели шагом 0.6 мм с обеих сторон
    x = -31.0 + k * 0.6
    if -12.3 < x < -10.7:
        continue
    gold.append(box(x - 0.2, x + 0.2, Y_I9[0] - 0.02, Y_I9[0], 55.0, 57.8))
    gold.append(box(x - 0.2, x + 0.2, Y_I9[1], Y_I9[1] + 0.02, 55.0, 57.8))
put('I9', 'metal', comp(gold))
Yc = Y_I9[1]
chips = [
    box(-11.5, 11.5, Yc + 0.45, Yc + 2.45, 58.5, 81.5),     # Artix-7 FGG484, 23×23
    box(15.0, 24.0, Yc, Yc + 1.2, 61.0, 74.0),              # DDR3, FBGA-96
    box(-21.0, -16.0, Yc, Yc + 1.5, 76.0, 82.0),            # SPI-флеш, SOIC-8
    box(-30.0, -23.0, Yc, Yc + 0.9, 60.0, 67.0),            # PHY Ethernet, QFN
    box(-30.0, -23.0, Yc, Yc + 0.9, 70.0, 77.0),
    box(26.0, 30.0, Yc, Yc + 0.9, 74.0, 78.0),              # DC-DC, QFN
]
put('I9', 'chip', comp(chips))
put('I9', 'metal', box(-11.0, 11.0, Yc, Yc + 0.45, 59.0, 81.0))   # шарики BGA одним слоем
# дроссели и мелочь
put('I9', 'ink', comp([box(26.0, 30.0, Yc, Yc + 1.8, 62.0, 66.0), box(26.0, 30.0, Yc, Yc + 1.8, 67.5, 71.5)]))
small = []
for k in range(26):
    x = -32.0 + (k * 7.3) % 64.0
    z = 56.5 + (k * 5.1) % 3.0 + (26.0 if k % 3 == 0 else 0)
    if -12 < x < 12 or 14 < x < 25:
        continue
    small.append(box(x, x + 1.0, Yc, Yc + 0.5, z, z + 0.5))
put('I9', 'shell', comp(small))

# SO-DIMM 200 pin угловой: корпус, контакты, защёлки
sock = box(-35.0, 35.0, 7.5, 12.5, 52.0, 57.0).cut(box(-33.0, 33.0, 10.9, 13.1, 55.0, 57.1))
put('Socket', 'ink', sock)
latch = []
for x0, x1 in ((-38.0, -35.0), (35.0, 38.0)):
    latch.append(box(x0, x1, 7.5, 13.2, 52.0, 83.0).cut(box(x0 + 1.0, x1 - 1.0, 7.4, 13.3, 58.0, 82.0)))
put('Socket', 'metal', comp(latch))
# теплосъём ПЛИС → крышка
hs = box(-11.5, 11.5, 15.0, 19.8, 58.5, 81.5)
for k in range(6):
    z = 60.5 + k * 3.6
    hs = hs.cut(box(-11.6, 11.6, 17.4, 19.9, z, z + 1.6))
put('Heat', 'alu', hs)

# ── мезонин АЦП: компоненты к главной плате (Y < 16.7) ─
YM = 16.7
can = box(-16.0, 16.0, 10.6, YM, 92.0, 100.5).cut(box(-15.7, 15.7, 10.9, YM + 0.1, 92.3, 100.2))
put('Mezz', 'metal', can)
adc = box(18.0, 25.0, YM - 1.4, YM, 91.5, 98.5)                                 # AD9288, LQFP-48 7×7
put('Mezz', 'chip', comp([adc, box(25.8, 28.8, YM - 1.1, YM, 92.0, 97.0)]))     # ADS1220, TSSOP-16
legs = []
for k in range(12):
    t = 91.5 + 0.25 + k * 0.5 + 0.1
    legs += [box(17.3, 18.0, YM - 0.9, YM - 0.7, t, t + 0.22), box(25.0, 25.7, YM - 0.9, YM - 0.7, t, t + 0.22)]
    u = 18.0 + 0.25 + k * 0.5 + 0.1
    legs += [box(u, u + 0.22, YM - 0.9, YM - 0.7, 90.8, 91.5), box(u, u + 0.22, YM - 0.9, YM - 0.7, 98.5, 99.2)]
put('Mezz', 'metal', comp(legs))
# межплатный разъём: гнездо на главной плате, штырь на мезонине
put('B2B', 'ink', box(-12.5, 14.5, 7.5, 12.0, 86.5, 90.5))
put('Mezz', 'ink', box(-12.0, 14.0, 12.0, YM, 86.8, 90.2))
for i, (x, z) in enumerate([(-26.0, 89.0), (26.0, 88.5)]):
    hexs = Part.Face(Part.makePolygon([V(x + 2.3 * math.cos(a), 7.5, z + 2.3 * math.sin(a)) for a in [k * math.pi / 3 for k in range(7)]]))
    put('Mezz', 'steel', hexs.extrude(V(0, YM - 7.5, 0)).cut(cyl_y(x, z, 1.0, 7.0, 17.0)))

# ── SMA торцевые: корпус с резьбой, шайба, гайка, изолятор, центральный штырь ─
for x in (-8.0, 8.0):
    y, z0, z1 = 17.5, 100.5, 112.0
    body = cyl_z(x, y, 3.175, z0, z1).cut(cyl_z(x, y, 2.05, 104.0, z1 + 0.1))
    for k in range(10):                                                         # резьба 1/4″-36 канавками
        zz = 106.0 + k * 0.6
        body = body.cut(cyl_z(x, y, 3.3, zz, zz + 0.25).cut(cyl_z(x, y, 3.0, zz - 0.1, zz + 0.35)))
    body = body.fuse(box(x - 3.2, x + 3.2, y - 3.2, y + 3.2, z0 - 1.0, z0 + 1.0))  # фланец к мезонину
    put('SMA', 'metal', body)
    put('SMA', 'steel', cyl_z(x, y, 4.8, 104.0, 104.5).cut(cyl_z(x, y, 3.25, 103.9, 104.6)))
    nut = Part.Face(Part.makePolygon([V(x + 4.62 * math.cos(a), y + 4.62 * math.sin(a), 104.5) for a in [k * math.pi / 3 for k in range(7)]]))
    put('SMA', 'metal', nut.extrude(V(0, 0, 2.0)).cut(cyl_z(x, y, 3.2, 104.4, 106.6)))
    put('SMA', 'ptfe', cyl_z(x, y, 2.05, 104.0, 111.2).cut(cyl_z(x, y, 0.66, 103.9, 111.3)))
    put('SMA', 'metal', cyl_z(x, y, 0.64, 104.0, 111.0))

# ── разъёмы внизу: HDMI Type A, USB-C, microSD ─────
hd = box(-30.0, -15.0, 3.9, 9.9, -0.3, 11.6)
trap = Part.Face(Part.makePolygon([V(-29.0, 4.6, -1), V(-16.0, 4.6, -1), V(-16.0, 7.6, -1), V(-17.2, 9.2, -1),
                                   V(-27.8, 9.2, -1), V(-29.0, 7.6, -1), V(-29.0, 4.6, -1)])).extrude(V(0, 0, 9.0))
put('Ports', 'metal', hd.cut(trap))
put('Ports', 'ink', box(-27.0, -18.0, 6.3, 7.6, 0.8, 8.2))                     # язычок с контактами
usb = box(-4.47, 4.47, 5.07, 8.33, -0.5, 7.0)
es = [e for e in usb.Edges if abs(e.Vertexes[0].Point.z - e.Vertexes[-1].Point.z) > 1e-6]
usb = usb.makeFillet(1.5, es)
ins = box(-4.1, 4.1, 5.44, 7.96, -0.6, 6.0)
es = [e for e in ins.Edges if abs(e.Vertexes[0].Point.z - e.Vertexes[-1].Point.z) > 1e-6]
put('Ports', 'metal', usb.cut(ins.makeFillet(1.2, es)))
put('Ports', 'ink', box(-3.3, 3.3, 6.35, 7.05, 0.2, 6.0))
put('Ports', 'metal', box(16.0, 28.0, 4.1, 5.9, 1.8, 13.3).cut(box(16.8, 27.2, 4.5, 5.5, 1.7, 12.5)))
put('Ports', 'ink', box(17.0, 27.0, 4.6, 5.4, 0.9, 12.0))                       # карта в слоте

# ── лицевая сторона платы: ESP32-C3-MINI-1, питание, кнопки ─
put('ESP', 'pcb', box(24.0, 40.6, 5.1, 5.9, 22.0, 35.2))
put('ESP', 'metal', box(24.4, 35.4, 3.5, 5.1, 22.4, 34.8))                     # экран модуля
ant = []
for k in range(6):                                                             # меандр антенны
    z = 23.0 + k * 2.0
    ant.append(box(36.4, 40.0, 5.06, 5.1, z, z + 0.5))
    xe = 39.5 if k % 2 == 0 else 36.4
    ant.append(box(xe, xe + 0.5, 5.06, 5.1, z, z + 2.5))
put('ESP', 'metal', comp(ant))
put('PMIC', 'chip', comp([box(-36.0, -32.0, 4.8, 5.9, 22.0, 26.0), box(-29.0, -26.0, 5.0, 5.9, 22.5, 25.5),
                          box(-20.0, -16.0, 5.0, 5.9, 28.0, 32.0)]))
put('PMIC', 'ink', comp([box(-36.0, -31.0, 4.1, 5.9, 28.0, 33.0), box(-25.0, -21.0, 4.5, 5.9, 28.5, 32.5)]))
put('PMIC', 'shell', comp([box(-24.0 + k * 2.0, -23.0 + k * 2.0, 5.3, 5.9, 21.5, 23.5) for k in range(5)]))
sw = []
for x, z in [(-25.5, 57.0), (-25.5, 43.0), (-32.5, 50.0), (-18.5, 50.0), (23.5, 59.0), (23.5, 41.0),
             (14.5, 50.0), (32.5, 50.0), (-8.0, 16.0), (0.0, 16.0), (8.0, 16.0)]:
    put('Switches', 'metal', box(x - 2.0, x + 2.0, 4.9, 5.9, z - 2.0, z + 2.0))
    sw.append(cyl_y(x, z, 1.1, 3.5, 4.9))
put('Switches', 'ink', comp(sw))

# ── аккумулятор: пауч со скруглениями, шов, выводы, плата защиты ─
bat = box(-34.0, 31.0, 10.4, 17.9, 3.0, 40.0)
es = [e for e in bat.Edges if abs(e.Vertexes[0].Point.y - e.Vertexes[-1].Point.y) < 1e-6]
put('Battery', 'pouch', bat.makeFillet(1.6, es))
put('Battery', 'pouch', box(-34.0, 31.0, 13.9, 14.4, 40.0, 42.5))                # шов
put('Battery', 'metal', comp([box(-12.0, -8.0, 14.0, 14.3, 42.5, 44.5), box(5.0, 9.0, 14.0, 14.3, 42.5, 44.5)]))
put('Battery', 'pcb', box(-16.0, 13.0, 13.3, 14.0, 42.0, 43.0))

# ── гребёнки: угловые гнёзда 2.54 мм, отверстия смотрят в верхний торец ─
contacts = []
for name, (x0, x1) in {'A': (-31.45, -6.05), 'PWR': (-2.54, 2.54), 'B': (6.05, 31.45)}.items():
    body = box(x0, x1, 7.5, 12.6, 141.5, 150.0)
    for k in range(round((x1 - x0) / 2.54)):
        cx = x0 + 1.27 + k * 2.54
        for cy in (8.78, 11.32):
            body = body.cut(box(cx - 0.5, cx + 0.5, cy - 0.5, cy + 0.5, 145.0, 150.1))
            contacts.append(box(cx - 0.5, cx + 0.5, cy - 0.5, cy + 0.5, 145.0, 145.4))   # контакт на дне
    put('Headers', 'ink', body)
put('Headers', 'metal', comp(contacts))


# ── тесселяция и GLB ─────────────────────────────────
def mesh_of(shapes):
    P, N, I = [], [], []
    for sh in shapes:
        for f in sh.Faces:
            try:
                pts, tris = f.tessellate(TOL)
            except Exception as e:
                print('skip face', e)
                continue
            if not tris:
                continue
            # ориентация: сверяем первый треугольник с нормалью грани
            a, b, c = (pts[i] for i in tris[0])
            tn = (b - a).cross(c - a)
            try:
                uv = f.Surface.parameter((a + b + c) * (1.0 / 3))
                fn = f.normalAt(*uv)
                flip = tn.dot(fn) < 0
            except Exception:
                flip = False
            base = len(P)
            acc = [V(0, 0, 0) for _ in pts]
            for t in tris:
                t = (t[0], t[2], t[1]) if flip else t
                p0, p1, p2 = (pts[i] for i in t)
                n = (p1 - p0).cross(p2 - p0)
                for i in t:
                    acc[i] = acc[i] + n
                I.extend(base + i for i in t)
            for p, n in zip(pts, acc):
                if n.Length > 0:
                    n.normalize()
                P.append((p.x, p.z, -p.y))                  # FreeCAD → glTF
                N.append((n.x, n.z, -n.y))
    return P, N, I


bin_ = bytearray()
views, accs, meshes, nodes = [], [], [], []


def add_view(data, target):
    while len(bin_) % 4:
        bin_.append(0)
    off = len(bin_)
    bin_.extend(data)
    views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), 'target': target})
    return len(views) - 1


tri_total = 0
for (group, mat), shapes in parts.items():
    P, N, I = mesh_of(shapes)
    if not I:
        continue
    tri_total += len(I) // 3
    pv = add_view(struct.pack(f'<{len(P) * 3}f', *[c for p in P for c in p]), 34962)
    nv = add_view(struct.pack(f'<{len(N) * 3}f', *[c for n in N for c in n]), 34962)
    iv = add_view(struct.pack(f'<{len(I)}I', *I), 34963)
    mn = [min(p[k] for p in P) for k in range(3)]
    mx = [max(p[k] for p in P) for k in range(3)]
    accs += [{'bufferView': pv, 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': mn, 'max': mx},
             {'bufferView': nv, 'componentType': 5126, 'count': len(N), 'type': 'VEC3'},
             {'bufferView': iv, 'componentType': 5125, 'count': len(I), 'type': 'SCALAR'}]
    a = len(accs) - 3
    meshes.append({'name': f'{group}__{mat}', 'primitives': [{'attributes': {'POSITION': a, 'NORMAL': a + 1}, 'indices': a + 2}]})
    nodes.append({'name': f'{group}__{mat}', 'mesh': len(meshes) - 1})
    print(f'{group}__{mat}: {len(I) // 3} tri')

gltf = {'asset': {'version': '2.0', 'generator': 'fabbit-site/scripts/export-model.py'},
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
        'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_)}]}
js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
while len(bin_) % 4:
    bin_.append(0)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_))
glb += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'wb').write(glb)
print(f'wrote {os.path.normpath(OUT)}: {len(nodes)} nodes, {tri_total} tri, {len(glb) / 1e6:.2f} MB')
sys.stdout.flush()
os._exit(0)          # freecadcmd падает при штатном завершении из-за Qt-моста MCP

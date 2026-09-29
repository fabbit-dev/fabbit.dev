import * as THREE from 'three';
import { pick } from './i18n.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Модель в миллиметрах, оси glTF: x вправо, y вверх (0…150), z к зрителю (перед корпуса z = 0).
const DEVICE_H = 150;
const CENTER = new THREE.Vector3(0, 75, -11);

// Узлы модели называются «Группа__материал» (scripts/export-model.py).
// Смещения групп при разлёте, мм: лицо вперёд, начинка слоями назад к крышке.
const EXPLODE = {
  Caps: [0, 0, 34], Panel: [0, 0, 26], Shell_Front: [0, 0, 16], Screen: [0, 0, 7],
  I9: [0, 0, -12], Heat: [0, 0, -22], Mezz: [0, 0, -12], SMA: [0, 6, -12],
  Battery: [0, 0, -26], Shell_Back: [0, 0, -42], Lid: [0, 0, -58],
  Wheel: [-18, 0, 0], Power: [-14, 0, 0], Headers: [0, 16, 0], Ports: [0, -14, 0],
  ESP: [22, 0, 0],   // выезжает за край платы: иначе с обеих сторон его закрывают плата и лицевая половина
};
// Снятие спинки (state.open): с тыльного ракурса спинка и крышка закрывают начинку, поэтому уходят вверх из кадра.
// Теплосъём ПЛИС приклеен к крышке и уходит вместе с ней.
const OPEN = { Shell_Back: [0, 320, -30], Lid: [0, 360, -40], Heat: [0, 360, -40] };

// Выноски: группы, подпись ({ ru, en } или одна строка на обоих языках), в какую сторону «смотрит» деталь (для скрытия с обратной стороны),
// at — своя опорная точка в координатах модели вместо центра деталей.
export const CALLOUTS = [
  { groups: ['Panel', 'Screen'], title: { ru: 'Экран', en: 'Screen' }, sub: '3,5″ · 640 × 480', dir: [0, 0, 1] },
  { groups: ['Caps'], title: { ru: 'Управление', en: 'Controls' }, sub: { ru: 'крестовина · F1–F4 · Fn, Меню, Назад', en: 'D-pad · F1–F4 · Fn, Menu, Back' }, dir: [0, 0, 1] },
  { groups: ['Wheel'], title: { ru: 'Колесо', en: 'Wheel' }, sub: { ru: 'масштаб и развёртка', en: 'zoom and timebase' }, dir: [-1, 0, 0.3] },
  { groups: ['I9'], title: { ru: 'ПЛИС Artix-7', en: 'Artix-7 FPGA' }, sub: { ru: 'модуль Colorlight i9+', en: 'Colorlight i9+ module' }, dir: [0, 0, -1] },
  { groups: ['Mezz'], title: { ru: 'Мезонин АЦП', en: 'ADC mezzanine' }, sub: { ru: 'два АЦП: быстрый и точный', en: 'two ADCs: fast and precise' }, dir: [0, 0, -1] },
  { groups: ['SMA'], title: '2 × SMA', sub: { ru: 'входы для щупов осциллографа', en: 'scope probe inputs' }, dir: [0, 0.4, -1] },
  { groups: ['PCB'], title: { ru: 'Главная плата', en: 'Mainboard' }, sub: { ru: 'в разводке', en: 'layout in progress' }, dir: [0, 0, -1], at: [36, 122, -7.5] },
  { groups: ['Battery'], title: { ru: 'Аккумулятор', en: 'Battery' }, sub: 'Li-Pol 1S', dir: [0, 0, -1] },
  { groups: ['Ports'], title: 'HDMI · USB-C · microSD', sub: { ru: 'нижний торец', en: 'bottom edge' }, dir: [0, -0.3, -1] },
  { groups: ['ESP'], title: 'ESP32-C3', sub: { ru: 'меню, карта памяти, загрузка ПЛИС', en: 'menu, memory card, FPGA loading' }, dir: [1, 0, -0.6] },
  // чертёж: органы управления на собранном приборе; колесо и выключатель на левом боку, в этом ракурсе он виден краем
  { bp: true, groups: ['Caps'], title: { ru: 'Крестовина', en: 'D-pad' }, sub: { ru: 'навигация', en: 'navigation' }, dir: [0, 0, 1], at: [-25.5, 50, 2.2] },
  { bp: true, groups: ['Caps'], title: 'F1 · F2 · F3 · F4', sub: { ru: 'действия профиля', en: 'profile actions' }, dir: [0, 0, 1], at: [23.5, 50, 2.2] },
  { bp: true, groups: ['Caps'], title: { ru: 'Fn · Меню · Назад', en: 'Fn · Menu · Back' }, sub: '', dir: [0, 0, 1], at: [0, 16, 0.8] },
  { bp: true, groups: ['Wheel'], title: { ru: 'Колесо', en: 'Wheel' }, sub: { ru: 'масштаб и развёртка', en: 'zoom and timebase' }, dir: [0, 0, 1], at: [-47.3, 116, -6] },
  { bp: true, groups: ['Power'], title: { ru: 'Выключатель', en: 'Power switch' }, sub: { ru: 'питание', en: 'power' }, dir: [0, 0, 1], at: [-45, 99.6, -6] },
];

// Размерные линии чертежа, мм в координатах модели.
export const DIMENSIONS = [
  { a: [-44, -12, 0], b: [44, -12, 0], label: '88' },
  { a: [54, 0, 0], b: [54, 150, 0], label: '150' },
  { a: [44, -12, 0], b: [44, -12, -22], label: '22' },   // продолжает линию ширины от правого угла
];

// mobile: без MSAA и с потолком плотности 1.5 — на телефоне экран мелкий, а заливка пикселей дорогая.
// bob — лёгкое покачивание в простое; без него кадр может «успокоиться», и loop перестаёт рисовать.
export async function createScene(canvas, screen, { mobile = false, bob = true, lang = 'ru' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  // Без живых теней: форму рисуют направленный свет и запечённое затенение.
  const key = new THREE.DirectionalLight(0xffffff, 2.2);      // сверху-слева
  key.position.set(-4, 4, 3.5);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4);     // мягкая подсветка справа
  fill.position.set(5, 0.5, 3);
  const rim = new THREE.DirectionalLight(0xffffff, 1.2);      // контровой: отделяет силуэт от фона
  rim.position.set(3, 3, -5);
  scene.add(key, fill, rim);

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  const CAM_Z = 10;
  camera.position.set(0, 0, CAM_Z);

  // pivot вращается, model внутри смещена так, чтобы центр корпуса был в начале координат
  const pivot = new THREE.Group();
  const model = new THREE.Group();
  model.position.copy(CENTER).multiplyScalar(-1);
  pivot.add(model);
  scene.add(pivot);

  const [gltf, ao] = await Promise.all([
    // GLB сжат meshopt и квантован (scripts/optimize-model.mjs): у узлов свой масштаб
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/fabbit_v1.glb'),
    // запечённое в Blender затенение (Cycles AO) по общей развёртке всех деталей, scripts/bake-model.py
    new THREE.TextureLoader().loadAsync('/models/fabbit_ao.webp'),
  ]);
  ao.flipY = false;                        // развёртка из glTF
  ao.colorSpace = THREE.NoColorSpace;
  model.add(gltf.scene);

  // Монохром бренда: светлый матовый корпус, светлый металл разъёмов, чёрные платы и микросхемы.
  const mats = {
    shell: new THREE.MeshPhysicalMaterial({ color: 0xE6E6E6, roughness: 0.58, clearcoat: 0.12, clearcoatRoughness: 0.6 }),
    panel: new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xD9D9D9, metalness: 1, roughness: 0.28 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xA3A3A3, metalness: 1, roughness: 0.35 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xC4C4C4, metalness: 1, roughness: 0.5 }),
    pouch: new THREE.MeshStandardMaterial({ color: 0xCFCFCF, metalness: 0.55, roughness: 0.42 }),
    ptfe: new THREE.MeshStandardMaterial({ color: 0xF5F5F5, roughness: 0.7 }),
    ink: new THREE.MeshStandardMaterial({ color: 0x0A0A0A, roughness: 0.45 }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.75 }),
    blank: new THREE.MeshStandardMaterial({ color: 0xB4B4B4, roughness: 0.9 }),   // главная плата и мезонин: заготовки
    chip: new THREE.MeshStandardMaterial({ color: 0x0E0E0E, roughness: 0.32 }),
  };
  for (const m of Object.values(mats)) { m.aoMap = ao; m.aoMapIntensity = 1; }

  const lineMat = new THREE.LineBasicMaterial({ color: 0x0A0A0A, transparent: true, opacity: 0, depthWrite: false });
  const parts = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const [group, mat] = o.name.split('__');
    o.material = mats[mat] ?? mats.ink;
    const off = EXPLODE[group] ?? [0, 0, 0];
    o.geometry.computeBoundingBox();
    parts.push({ mesh: o, group, base: o.position.clone(), off: new THREE.Vector3(...off), open: new THREE.Vector3(...(OPEN[group] ?? [0, 0, 0])), edges: null });
  });

  // Рёбра для чертежа нужны только в конце страницы. Считаем их в простое, по детали за раз,
  // чтобы не задерживать первый кадр; если чертёж понадобился раньше, досчитываем сразу.
  const buildEdges = (p) => {
    if (p.edges) return;
    p.edges = new THREE.LineSegments(new THREE.EdgesGeometry(p.mesh.geometry, 28), lineMat);
    p.edges.visible = false;
    p.edges.renderOrder = 1; // после всех тел: иначе порядок зависит от сортировки по расстоянию и рёбра мигают
    p.mesh.add(p.edges);
  };
  const idle = window.requestIdleCallback ?? ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 200));
  let edgeQueue = [...parts];
  const edgeStep = (deadline) => {
    while (edgeQueue.length && deadline.timeRemaining() > 2) buildEdges(edgeQueue.shift());
    if (edgeQueue.length) idle(edgeStep);
  };
  idle(edgeStep);

  // Экран и маркировка ПЛИС — свои плоскости в координатах модели. Дочерними к деталям их не сделать:
  // у квантованных узлов свой масштаб. Поэтому они повторяют смещение детали при разлёте.
  const followers = [];
  const follow = (part, obj) => { if (!part) return; model.add(obj); followers.push({ part, obj, base: obj.position.clone() }); };

  // Экран: плоскость поверх чёрной панели, текстура — canvas фреймбуфера
  const tex = new THREE.CanvasTexture(screen.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Разрешение текстуры подгоняется под экран в кадре (screenPixels), поэтому
  // мипмапы не нужны: они брали бы уменьшенный уровень и мылили картинку.
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
  // окно экрана 70×51, картинка 4:3 по высоте окна
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(68, 51), screenMat);
  screenMesh.position.set(0, 116, 0.12);
  follow(parts.find((p) => p.group === 'Panel'), screenMesh);   // экран едет вместе с панелью

  // Маркировка ПЛИС: лазерная гравировка на крышке FGG484 (23×23 мм, верх на z −14.95, смотрит к спинке)
  const mark = document.createElement('canvas');
  mark.width = mark.height = 512;
  const g = mark.getContext('2d');
  g.fillStyle = '#8C8C8C';
  g.font = '700 58px "JetBrains Mono", monospace';
  ['XILINX', 'ARTIX-7'].forEach((t, i) => g.fillText(t, 48, 150 + i * 72));
  g.font = '500 44px "JetBrains Mono", monospace';
  ['XC7A50T', 'FGG484'].forEach((t, i) => g.fillText(t, 48, 330 + i * 60));
  g.beginPath(); g.arc(456, 456, 16, 0, Math.PI * 2); g.fill();   // метка первого вывода
  const markTex = new THREE.CanvasTexture(mark);
  markTex.colorSpace = THREE.SRGBColorSpace;
  markTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  mats.mark = new THREE.MeshStandardMaterial({ map: markTex, alphaTest: 0.3, roughness: 0.6 });
  const markMesh = new THREE.Mesh(new THREE.PlaneGeometry(23, 23), mats.mark);
  markMesh.rotation.y = Math.PI;
  markMesh.position.set(0, 70, -14.97);
  follow(parts.find((p) => p.group === 'I9' && p.mesh.material === mats.chip), markMesh);

  const solids = Object.values(mats);
  for (const m of solids) { m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1; }
  // Штатный aoMap в three.js затемняет только рассеянный свет. Добавляем его и к прямому,
  // чтобы лунки кнопок, пазы и зазоры между микросхемами читались под направленным светом.
  const aoDirect = { value: 0.85 };
  for (const m of solids) {
    if (!m.aoMap) continue;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uAoDirect = aoDirect;
      sh.fragmentShader = 'uniform float uAoDirect;\n' + sh.fragmentShader.replace(
        '#include <aomap_fragment>',
        '#include <aomap_fragment>\n\treflectedLight.directDiffuse *= mix( 1.0, ambientOcclusion, uAoDirect );',
      );
    };
  }

  // Опорные точки выносок: центр суммарного bbox деталей в координатах модели
  const callouts = CALLOUTS.map((c) => {
    const ps = parts.filter((p) => c.groups.includes(p.group));
    return { ...c, parts: ps, dirV: new THREE.Vector3(...c.dir).normalize(), atV: c.at && new THREE.Vector3(...c.at) };
  });

  const state = { x: 0.4, y: 0, h: 0.78, rx: 0.1, ry: -0.5, rz: 0.04, explode: 0, open: 0, lines: 0 };
  const extra = { rx: 0, ry: 0, y: 0, s: 1 }; // интро и мышь

  let W = 1, H = 1;
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  resize();

  const visH = () => 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  let solidTransparent = false;
  const tmp = new THREE.Vector3(), tmpB = new THREE.Box3(), tmpB2 = new THREE.Box3(), camDir = new THREE.Vector3();
  const vCenter = new THREE.Vector3(), vWorld = new THREE.Vector3(), vLocal = new THREE.Vector3(), vDir = new THREE.Vector3();
  const nmat = new THREE.Matrix3();

  function apply(time) {
    const vh = visH(), vw = vh * camera.aspect;
    const s = (state.h * vh / DEVICE_H) * extra.s;
    pivot.scale.setScalar(s);
    const b = bob ? 1 : 0;
    pivot.position.set(state.x * vw / 2, (state.y + extra.y) * vh / 2 + b * Math.sin(time * 0.8) * 0.012 * vh, 0);
    pivot.rotation.set(state.rx + extra.rx, state.ry + extra.ry, state.rz + b * Math.sin(time * 0.5) * 0.008);

    const e = state.explode;
    // затенение запечено для собранного прибора: при разлёте оно гаснет, иначе под улетевшими
    // деталями остаются тёмные пятна
    const aoK = 1 - THREE.MathUtils.smoothstep(e, 0, 0.3);
    for (const m of solids) if (m.aoMap) m.aoMapIntensity = aoK;
    aoDirect.value = aoK * 0.85;
    for (const p of parts) p.mesh.position.copy(p.base).addScaledVector(p.off, e).addScaledVector(p.open, state.open);
    for (const f of followers) f.obj.position.copy(f.base).add(f.part.mesh.position).sub(f.part.base);

    const L = state.lines;
    lineMat.opacity = L;
    const showLines = L > 0.001;
    if (showLines && edgeQueue.length) { edgeQueue.forEach(buildEdges); edgeQueue = []; }
    for (const p of parts) if (p.edges) p.edges.visible = showLines;
    const needT = L > 0.001;
    if (needT !== solidTransparent) {
      solidTransparent = needT;
      // Прозрачные тела всё равно пишут глубину и прячут невидимые рёбра. Смещение глубины
      // отодвигает тело от собственных рёбер, чтобы они не спорили в z-буфере.
      for (const m of solids) { m.transparent = needT; m.polygonOffset = needT; m.needsUpdate = true; }
    }
    for (const m of solids) m.opacity = 1 - L;
    screenMat.opacity = 1 - L;
    pivot.visible = true;
  }

  function project(v) {
    tmp.copy(v).project(camera);
    return [(tmp.x * 0.5 + 0.5) * W, (-tmp.y * 0.5 + 0.5) * H, tmp.z];
  }

  // Данные для 2D-слоя: экранные координаты выносок и размеров
  function overlayData() {
    pivot.updateMatrixWorld(true);
    camera.getWorldDirection(camDir);
    nmat.getNormalMatrix(pivot.matrixWorld);
    const center = project(pivot.getWorldPosition(vCenter));
    // экранные границы сборки, чтобы подписи стояли снаружи; снятые спинка и крышка не в счёт
    let x0 = Infinity, x1 = -Infinity;
    for (const p of parts) {
      if (state.open > 0.5 && p.open.lengthSq() > 0) continue;
      const bb = p.mesh.geometry.boundingBox;
      for (let i = 0; i < 8; i++) {
        tmp.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
        const [sx] = project(p.mesh.localToWorld(tmp));
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx);
      }
    }
    const cs = callouts.map((c) => {
      const facing = -vDir.copy(c.dirV).applyMatrix3(nmat).normalize().dot(camDir);
      if (c.atV) {
        // своя точка едет вместе с группой при разлёте
        const p = c.parts[0];
        vLocal.copy(c.atV).add(p.mesh.position).sub(p.base);
        return { ...project(model.localToWorld(vLocal)), facing, title: pick(c.title, lang), sub: pick(c.sub, lang), group: c.groups[0], bp: !!c.bp };
      }
      tmpB.makeEmpty();
      for (const p of c.parts) {
        tmpB.union(tmpB2.copy(p.mesh.geometry.boundingBox).applyMatrix4(p.mesh.matrixWorld));
      }
      const world = tmpB.getCenter(vWorld);
      return { ...project(world), facing, title: pick(c.title, lang), sub: pick(c.sub, lang), group: c.groups[0], bp: !!c.bp };
    });
    const toWorld = (a) => model.localToWorld(new THREE.Vector3(...a));
    const dims = DIMENSIONS.map((d) => ({ a: project(toWorld(d.a)), b: project(toWorld(d.b)), label: d.label }));
    return { center, box: [x0, x1], callouts: cs, dims };
  }

  function render(time, screenChanged) {
    apply(time);
    if (screenChanged) tex.needsUpdate = true;   // грузим текстуру только когда экран перерисован
    renderer.render(scene, camera);
  }

  // Сколько физических пикселей монитора занимает экран прибора: [ширина, высота]
  const corners = [[-34, -25.5], [34, -25.5], [-34, 25.5], [34, 25.5]].map(([x, y]) => new THREE.Vector3(x, y, 0));
  const cv = new THREE.Vector3();
  function screenPixels() {
    pivot.updateMatrixWorld(true);
    const pr = renderer.getPixelRatio();
    const pts = corners.map((c) => { cv.copy(c).applyMatrix4(screenMesh.matrixWorld).project(camera); return [cv.x * W / 2 * pr, cv.y * H / 2 * pr]; });
    const w = Math.max(Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), Math.hypot(pts[3][0] - pts[2][0], pts[3][1] - pts[2][1]));
    const h = Math.max(Math.hypot(pts[2][0] - pts[0][0], pts[2][1] - pts[0][1]), Math.hypot(pts[3][0] - pts[1][0], pts[3][1] - pts[1][1]));
    return [w, h];
  }
  // canvas экрана поменял размер — старую текстуру надо освободить, иначе WebGL оставит прежний размер
  function screenResized() { tex.dispose(); tex.needsUpdate = true; }

  // Экран прибора виден зрителю: не чертёж, не разлёт и лицом к камере.
  // Пока он не виден, текстуру экрана незачем перерисовывать и грузить в GPU.
  function screenVisible() {
    return state.lines < 0.99 && state.explode < 0.6 && Math.cos(state.ry + extra.ry) * Math.cos(state.rx + extra.rx) > 0.15;
  }

  // Шейдеры всех материалов собираются до первого кадра и, где есть KHR_parallel_shader_compile,
  // в фоне: иначе первый render() компилирует их синхронно и держит главный поток сотни миллисекунд
  // как раз тогда, когда страницу начинают листать.
  apply(0);
  await renderer.compileAsync(scene, camera).catch(() => {});
  return { state, extra, render, resize, overlayData, renderer, tex, screenPixels, screenResized, screenVisible, bobbing: bob };
}

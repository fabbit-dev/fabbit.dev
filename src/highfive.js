// Два пиксельных человечка сходятся, дают пять и расходятся. Сетка как у зайца: 1 клетка = N px.
// Показывается в главе «Команда»; крутится, только пока сцена на экране.

export const HF_W = 48, HF_H = 28;
const PW = 9, PH = 22, FLOOR = HF_H - PH; // человечек 9×22 стоит на полу сцены

// Человечек смотрит вправо. arm: 'down' | 'up'; walk: ноги врозь.
function person({ arm = 'down', walk = false } = {}) {
  const G = Array.from({ length: PH }, () => new Array(PW).fill('.'));
  const px = (x, y) => { G[y][x] = '#'; };
  const row = (y, x0, x1) => { for (let x = x0; x <= x1; x++) px(x, y); };
  // голова с глазом
  row(0, 3, 5); row(1, 2, 6); row(2, 2, 6); row(3, 2, 6); row(4, 3, 5);
  G[2][5] = '.';
  px(4, 5);                                   // шея
  row(6, 1, 7);                               // плечи
  for (let y = 7; y <= 13; y++) row(y, 2, 6); // туловище
  for (let y = 7; y <= 12; y++) px(1, y);     // дальняя рука
  if (arm === 'up') { px(7, 5); for (let y = 0; y <= 4; y++) px(8, y); }
  else for (let y = 7; y <= 12; y++) px(7, y);
  if (walk) {
    for (let y = 14; y <= 17; y++) { row(y, 1, 2); row(y, 6, 7); }
    for (let y = 18; y <= 20; y++) { row(y, 0, 1); row(y, 7, 8); }
    row(21, 0, 1); row(21, 7, 8);
  } else {
    for (let y = 14; y <= 20; y++) { row(y, 2, 3); row(y, 5, 6); }
    row(21, 2, 3); row(21, 5, 7);
  }
  return G.map((r) => r.join(''));
}
const mirror = (G) => G.map((r) => [...r].reverse().join(''));

// Искры над ладонями: короткие лучи вверх и в стороны от точки хлопка
const SPARK_1 = [[20, 3], [21, 4], [23, 1], [23, 2], [24, 1], [24, 2], [26, 4], [27, 3]];
const SPARK_2 = [[18, 2], [19, 3], [20, 3], [23, 0], [24, 0], [27, 3], [28, 3], [29, 2], [17, 6], [30, 6]];

function frame(L, R, pose, extra = [], lift = 0) {
  const C = Array.from({ length: HF_H }, () => new Array(HF_W).fill(false));
  const put = (G, ox, oy) => G.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '#' && oy + y >= 0 && oy + y < HF_H && ox + x >= 0 && ox + x < HF_W) C[oy + y][ox + x] = true;
  }));
  put(person(pose), L, FLOOR - lift);
  put(mirror(person(pose)), R, FLOOR - lift);
  for (const [x, y] of extra) C[y][x] = true;
  let d = '';
  C.forEach((r, y) => {
    for (let x = 0; x < HF_W;) {
      if (!r[x]) { x++; continue; }
      const x0 = x; while (x < HF_W && r[x]) x++;
      d += `M${x0} ${y}h${x - x0}v1h-${x - x0}z`;
    }
  });
  return d;
}

const f = (ms, L, R, pose, extra, lift, name) => ({ ms, d: frame(L, R, pose, extra, lift), name });

// Полный цикл. Последний кадр совпадает с первым, поэтому проигрыватель его пропускает.
export function highFive() {
  const stand = {}, walk = { walk: true }, up = { arm: 'up' };
  return [
    f(700, 4, 35, stand, [], 0, 'idle'),
    f(120, 7, 32, walk), f(120, 10, 29, stand), f(120, 12, 27, walk),
    f(160, 14, 25, up),
    f(90, 15, 24, up, SPARK_1, 0, 'clap'),
    f(120, 15, 24, up, SPARK_2),
    f(160, 15, 24, up, [], 1),
    f(260, 15, 24, stand),
    f(120, 12, 27, walk), f(120, 10, 29, stand), f(120, 7, 32, walk),
    f(700, 4, 35, stand, [], 0, 'idle'),
  ];
}

export function mountHighFive(svg, { reduced = false } = {}) {
  svg.setAttribute('viewBox', `0 0 ${HF_W} ${HF_H}`);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('shape-rendering', 'crispEdges');
  svg.append(path);
  const frames = highFive();
  const show = (fr) => path.setAttribute('d', fr.d);
  // до запуска и без анимации — кадр хлопка: даже неподвижная картинка читается как «дай пять»
  show(frames.find((x) => x.name === 'clap'));
  if (reduced) return;

  const loop = frames.slice(0, -1);
  let i = 0, timer = 0, running = false, onScreen = false;
  const tick = () => {
    if (!running) return;
    const fr = loop[i]; i = (i + 1) % loop.length;
    show(fr);
    timer = setTimeout(tick, fr.ms);
  };
  const sync = () => {
    const want = onScreen && !document.hidden;
    if (want === running) return;
    running = want;
    if (running) tick(); else clearTimeout(timer);
  };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }).observe(svg);
  document.addEventListener('visibilitychange', sync);
}

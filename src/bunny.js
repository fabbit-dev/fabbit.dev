// Заяц рядом со словом Fabbit в hero. Та же сетка 16×19, что в brand-kit
// (_source/mark16x20.txt), варианты глаз оттуда же (_source/anim.py).
// Между простоем с морганием случайно проигрываются сценки.

const MARK = `
.###.......###..
.###.......###..
.####....#####..
.####....#####..
.####....#####..
.####....#####..
.####..#####....
.####..#####....
..##########....
..############..
..############..
################
###..######..###
###..######..###
################
#######..#######
#######..#######
..############..
..############..`.trim().split('\n');

const SW = 24, SH = 19; // сцена в клетках: заяц 16 + место под «Z» и лежачую позу

const EYES = [[3, 12], [4, 12], [3, 13], [4, 13], [11, 12], [12, 12], [11, 13], [12, 13]];
const EYE_KINDS = {
  open: EYES,
  closed: [[3, 13], [4, 13], [11, 13], [12, 13]],
  half: [[3, 13], [4, 13], [11, 13], [12, 13], [3, 12], [12, 12]],
  wink: [[3, 12], [4, 12], [3, 13], [4, 13], [11, 13], [12, 13]],
  happy: [[3, 13], [4, 12], [5, 13], [10, 13], [11, 12], [12, 13]],
  x: [[3, 11], [5, 11], [4, 12], [3, 13], [5, 13], [10, 11], [12, 11], [11, 12], [10, 13], [12, 13]],
  left: [[2, 12], [3, 12], [2, 13], [3, 13], [10, 12], [11, 12], [10, 13], [11, 13]],
  right: [[4, 12], [5, 12], [4, 13], [5, 13], [12, 12], [13, 12], [12, 13], [13, 13]],
};

const grid = (rows) => rows.map((r) => [...r]);
const holes = (G, pts, v) => { G = grid(G); for (const [x, y] of pts) G[y][x] = v; return G.map((r) => r.join('')); };
const BASE = holes(MARK, EYES, '#');
const eyes = (k) => holes(BASE, EYE_KINDS[k], '.');
const squash = (G) => G.filter((_, i) => i !== 9);
const stretch = (G) => [...G.slice(0, 6), G[5], ...G.slice(6)];
// поворот на 90° по часовой: заяц падает на бок, ушами вправо
const lying = (G) => G[0].split('').map((_, x) => G.map((_, y) => G[G.length - 1 - y][x]).join(''));
const Z = ['###', '..#', '.#.', '###'];
const SOUL = ['.#.#.', '.#.#.', '#####', '#.#.#', '#####', '#.#.#']; // маленький заяц-призрак

// Кадр: список [сетка, x, y]. at() ставит стоящего зайца на пол: у сеток знака последняя строка пустая
const at = (G, x = 0, up = 0) => [G, x, SH - G.length + 1 - up];
const f = (ms, ...items) => ({ ms, items });
const still = (k, ms) => f(ms, at(eyes(k)));

const SCENES = {
  blink: () => [still('half', 60), still('closed', 110), still('half', 60), still('open', 200)],
  wink: () => [still('open', 250), still('wink', 520), still('open', 300)],
  look: () => [still('left', 700), still('open', 250), still('right', 700), still('open', 300)],
  hop: () => {
    const o = eyes('open'), h = eyes('happy');
    return [
      f(120, at(squash(o))), f(70, at(stretch(o), 0, 1)), f(70, at(h, 0, 3)), f(110, at(h, 0, 4)),
      f(70, at(h, 0, 3)), f(70, at(stretch(o), 0, 1)), f(140, at(squash(o))), still('open', 300),
    ];
  },
  sleep: () => {
    const c = eyes('closed'), out = [still('half', 250)];
    for (let t = 0; t < 18; t++) {
      const items = [at(c)];
      for (let k = 0; k < 3; k++) {
        const p = (t + k * 4) % 12;
        if (p < 9) items.push([Z, 17 + Math.floor(p / 3), 7 - p]);
      }
      out.push(f(170, ...items));
    }
    return [...out, still('half', 120), still('open', 300)];
  },
  die: () => {
    const x = eyes('x'), down = lying(x);
    const ly = SH - down.length;
    const shake = [1, 0, 1, 0, 1, 0].map((dx) => f(55, at(x, dx)));
    const soul = [0, 2, 4, 6, 8].map((u) => f(160, [down, 0, ly], [SOUL, 7, ly - 6 - u]));
    return [
      still('open', 200), f(260, at(x)), ...shake, f(160, at(squash(x))),
      f(70, [down, 0, ly - 1]), f(900, [down, 0, ly]), ...soul, f(700, [down, 0, ly]),
      f(120, at(squash(eyes('closed')))), still('half', 140), still('open', 400),
    ];
  },
};
const FUN = ['wink', 'look', 'hop', 'sleep', 'die', 'wink', 'hop', 'die'];

function pathFor(items) {
  const C = Array.from({ length: SH + 20 }, () => new Array(SW).fill(false));
  const OY = 20; // запас сверху: прыжок и душа вылетают за сцену (svg overflow: visible)
  for (const [G, x, y] of items) {
    G.forEach((row, r) => [...row].forEach((ch, c) => {
      const yy = y + r + OY, xx = x + c;
      if (ch === '#' && yy >= 0 && yy < C.length && xx >= 0 && xx < SW) C[yy][xx] = true;
    }));
  }
  let d = '';
  C.forEach((row, y) => {
    for (let x = 0; x < SW;) {
      if (!row[x]) { x++; continue; }
      const x0 = x; while (x < SW && row[x]) x++;
      d += `M${x0} ${y - OY}h${x - x0}v1h${x0 - x}z`;
    }
  });
  return d;
}

export const SCENE_NAMES = Object.keys(SCENES);
// Кадры сценки как пути SVG в клетках сцены 24×19: { ms, d }.
export const scene = (name) => SCENES[name]().map((fr) => ({ ms: fr.ms, d: pathFor(fr.items) }));

// trigger — кнопка вокруг svg: клик и Enter/пробел запускают случайную сценку.
export function mountBunny(svg, { reduced = false, trigger = svg } = {}) {
  svg.setAttribute('viewBox', `0 0 ${SW} ${SH}`);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('shape-rendering', 'crispEdges');
  svg.append(path);
  const show = (fr) => path.setAttribute('d', pathFor(fr.items));
  show(still('open', 0));
  if (reduced) {
    // без анимаций заяц просто стоит: кнопка ничего бы не делала, поэтому убираем её из фокуса
    if (trigger !== svg) { trigger.tabIndex = -1; trigger.setAttribute('aria-hidden', 'true'); trigger.style.cursor = 'default'; }
    return;
  }

  let queue = [], timer = 0, running = false, last = '';
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = () => {
    let s; do s = FUN[Math.floor(Math.random() * FUN.length)]; while (s === last);
    return (last = s);
  };
  // простой: 1–2 моргания, потом сценка
  const refill = () => {
    for (let i = 0, n = 1 + (Math.random() < 0.5); i < n; i++) queue.push(still('open', rand(1400, 2600)), ...SCENES.blink());
    queue.push(still('open', rand(600, 1200)), ...SCENES[pick()]());
  };
  const tick = () => {
    if (!running) return;
    if (!queue.length) refill();
    const fr = queue.shift();
    show(fr);
    timer = setTimeout(tick, fr.ms);
  };
  const play = (name) => { queue = SCENES[name](); clearTimeout(timer); tick(); };

  let onScreen = false;
  const sync = () => {
    const want = onScreen && !document.hidden;
    if (want === running) return;
    running = want;
    if (running) tick(); else clearTimeout(timer);
  };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }).observe(svg);
  document.addEventListener('visibilitychange', sync);
  trigger.addEventListener('click', () => running && play(pick()));
}

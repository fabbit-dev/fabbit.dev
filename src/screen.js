// Экран прибора: чёрно-белый, логические 640×480 (как у кадров загрузки из бренд-кита),
// canvas в 2 раза больше для чёткой текстуры. Линии и текст векторные, пиксельные иконки —
// в целых масштабах без сглаживания.
import { createDoom } from './doom.js';

import { PROFILES } from './profiles.js';
export { PROFILES };

const W = 640, H = 480;                 // логические пиксели экрана
const TOP = 60, BOTTOM = 432;           // рабочая область между шапкой и подвалом
const MONO = '"JetBrains Mono", ui-monospace, monospace';

// Надписи экрана на языке страницы (en/index.html — английский). Остальное на экране — единицы СИ и имена сигналов.
const TXT = {
  ru: { div: '1 µs/дел', width: 'ширина 40 нс', delay: 'задержка 1.2 мкс',
    profiles: 'ФУНКЦИИ', load: 'ДЕМО', profile: '◀ ▶ ФУНКЦИЯ', demo: 'ДЕМО' },
  en: { div: '1 µs/div', width: 'width 40 ns', delay: 'delay 1.2 µs',
    profiles: 'FUNCTIONS', load: 'DEMO', profile: '◀ ▶ FUNCTION', demo: 'DEMO' },
};

export { TXT as SCREEN_TXT };
export function createScreen({ scale = 2, lang = 'ru' } = {}) {
  const T = TXT[lang] ?? TXT.ru;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale; canvas.height = H * scale;
  // Масштаб подбирается под реальный размер экрана в кадре (см. main.js):
  // текстура совпадает с пикселями монитора, и картинка не мылится.
  function setScale(s) {
    if (Math.abs(s - scale) < 0.01) return false;
    scale = s;
    canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
    return true;
  }
  const g = canvas.getContext('2d');

  let atlas = null, atlasIndex = {};
  let boot = null, bootDur = [];        // лента кадров загрузки: одна картинка вместо 60
  let mode = 'boot', profile = 0, modeStart = 0, clock = 0;
  const doom = createDoom();

  const img = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const ready = (async () => {
    const [a, idx, meta, strip] = await Promise.all([
      img('/brand/icons/atlas-16-white.png'),
      fetch('/brand/icons/atlas-16.json').then((r) => r.json()).catch(() => ({})),
      fetch('/brand/boot/strip.json').then((r) => r.json()).catch(() => null),
      img('/brand/boot/strip.webp'),
    ]);
    atlas = a; atlasIndex = idx;
    if (meta && strip) { boot = { ...meta, img: strip }; bootDur = meta.durations; }
  })();

  // ── примитивы ─────────────────────────────────
  const WHITE = '#fff', BLACK = '#000';
  const icon = (id, x, y, s = 2) => {
    if (!atlas || atlasIndex[id] == null) return;
    g.imageSmoothingEnabled = false;
    g.drawImage(atlas, atlasIndex[id], 0, 16, 16, x, y, 16 * s, 16 * s);
  };
  const text = (s, x, y, size = 18, align = 'left', weight = 500) => {
    g.font = `${weight} ${size}px ${MONO}`; g.textAlign = align; g.textBaseline = 'top'; g.fillText(s, x, y);
  };
  const rect = (x, y, w, h) => g.fillRect(x, y, w, h);
  const frame = (x, y, w, h, lw = 2) => { g.lineWidth = lw; g.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw); };
  const line = (pts, lw = 2, dash = null) => {
    g.lineWidth = lw; g.setLineDash(dash || []);
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.setLineDash([]);
  };
  const plot = (x0, x1, f, lw = 2, step = 1) => {
    const pts = [];
    for (let x = x0; x <= x1; x += step) pts.push([x, f(x)]);
    line(pts, lw);
  };
  // ступенчатый цифровой сигнал
  const digital = (x0, x1, hi, lo, bit) => {
    const pts = []; let prev = null;
    for (let x = x0; x <= x1; x++) {
      const y = bit(x) ? hi : lo;
      if (prev !== null && y !== prev) pts.push([x, prev]);
      pts.push([x, y]); prev = y;
    }
    line(pts, 2);
  };

  function bar(title, id) {
    icon(id, 16, 12, 2);
    text(title, 60, 18, 20, 'left', 700);
    icon('battery-full', W - 48, 12, 2);
    text(T.demo, W - 70, 20, 16, 'right', 700);
    rect(0, 52, W, 2);
  }
  function footer(left, right) {
    rect(0, 438, W, 2);
    text(left, 16, 450, 17, 'left', 500);
    text(right, W - 16, 450, 17, 'right', 700);
  }

  // ── экраны профилей ───────────────────────────
  const viz = {
    logic(t) {
      const x0 = 70, x1 = W - 20, top = 76, rowH = 56;
      const periods = [16, 32, 64, 24, 48, 80];
      for (let c = 0; c < 6; c++) {
        const y = top + c * rowH;
        text('D' + c, 18, y + 12, 18, 'left', 700);
        digital(x0, x1, y + 4, y + 34, (x) =>
          Math.floor((x + t * 120) / periods[c] + c * 0.37 + Math.sin((x + t * 120) * 0.0065 * (c + 1)) * 0.6) & 1);
      }
      line([[360, TOP + 8], [360, 424]], 2, [6, 6]);
      text('T', 368, TOP + 6, 16, 'left', 700);
    },
    scope(t) {
      const x0 = 16, x1 = W - 16, y0 = TOP + 8, y1 = 428, cy = (y0 + y1) / 2;
      for (let i = 0; i <= 10; i++) { const x = x0 + (x1 - x0) * i / 10; line([[x, y0], [x, y1]], 1, [2, 8]); }
      for (let i = 0; i <= 8; i++) { const y = y0 + (y1 - y0) * i / 8; line([[x0, y], [x1, y]], 1, [2, 8]); }
      line([[x0, cy], [x1, cy]], 1);
      const u = (x) => (x - x0) / (x1 - x0);
      plot(x0, x1, (x) => cy - 50 + Math.sin(u(x) * 14 + t * 3) * 80 + Math.sin(u(x) * 90 + t * 20) * 3, 2.5, 2);
      plot(x0, x1, (x) => {
        const k = u(x) * 6 + t * 0.6;
        return cy + 100 + (Math.floor(k) & 1 ? -1 : 1) * 44 * Math.exp(-(k % 1) * 3);
      }, 2.5, 2);
      text('CH1 500 mV', 26, y0 + 10, 16, 'left', 700);
      text('CH2 1 V', 26, y1 - 28, 16, 'left', 700);
      text(T.div, x1 - 10, y0 + 10, 16, 'right', 500);
    },
    retro(t, x, y, w, h) {
      doom.draw(g, t, x, y, w, h);
    },
    debug(t) {
      text('CMSIS-DAP v2', 24, 88, 28, 'left', 700);
      text('SWD / JTAG / TRACE', 24, 132, 20);
      const pc = 0x08001200 + (Math.floor(t * 2) % 32) * 4;
      for (let i = 0; i < 5; i++) {
        const y = 190 + i * 42;
        text('0x' + (pc + i * 4).toString(16).toUpperCase(), 24, y, 22);
        text(['PUSH {R4, LR}', 'LDR R0, [R1]', 'CMP R0, #0', 'BNE 0x08001200', 'POP {R4, PC}'][i], 250, y, 22);
      }
    },
    generator(t) {
      text('GEN', 24, 84, 28, 'left', 700);
      text('1 kHz', W - 24, 84, 28, 'right');
      line([[24, 265], [W - 24, 265]], 1, [4, 6]);
      plot(24, W - 24, (x) => 265 - Math.sin(x / W * Math.PI * 8 + t * 2) * 90, 3, 2);
      text('1.0 Vpp', 24, 390, 24);
    },
    multimeter(t) {
      text('ADS1220', 24, 88, 24, 'left', 700);
      text((3.3 + Math.sin(t) * .002).toFixed(4) + ' V', W / 2, 170, 62, 'center', 700);
      frame(24, 285, W - 48, 110);
      text('10.000 kΩ', W / 2, 318, 38, 'center');
    },
    psu(t) {
      text('CV', 24, 84, 26, 'left', 700);
      text('5.00 V', 24, 142, 58, 'left', 700);
      text((.12 + Math.sin(t) * .002).toFixed(3) + ' A', 24, 225, 48);
      text('0.60 W', W - 24, 150, 30, 'right');
      text('0.01 Wh', W - 24, 232, 30, 'right');
      plot(24, W - 24, (x) => 370 - Math.sin(x * .03 + t) * 8, 2, 2);
    },
    glitch(t) {
      const x0 = 16, x1 = W - 16, hi = 150, lo = 290, gx = x0 + (x1 - x0) * 0.55;
      const on = (t * 0.8) % 1 > 0.3;
      text('VCC', 16, TOP + 16, 18, 'left', 700);
      line([[x0, hi], [gx - 6, hi], [gx - 6, on ? lo : hi], [gx + 6, on ? lo : hi], [gx + 6, hi], [x1, hi]], 2.5);
      text(T.width, gx + 18, lo - 14, 16);
      text(T.delay, gx + 18, lo + 10, 16);
      line([[x0 + 60, hi - 30], [gx - 6, hi - 30]], 1, [4, 4]);
    },
  };

  function drawMenu(t) {
    bar(T.profiles, 'folder');
    const cols = 3, cw = 196, ch = 122, ox = (W - cols * cw) / 2, oy = TOP + 6;
    const sel = Math.floor(t * 1.1) % PROFILES.length;
    PROFILES.forEach((p, i) => {
      const x = ox + (i % cols) * cw, y = oy + Math.floor(i / cols) * ch;
      if (i === sel) frame(x + 10, y + 4, cw - 20, ch - 8, 3);
      icon(p.icon, x + cw / 2 - 24, y + 22, 3);
      text(p.id.toUpperCase(), x + cw / 2, y + 84, 15, 'center', 700);
    });
    footer(T.load, `${sel + 1}/${PROFILES.length}`);
  }

  let lastBoot = -1;
  const bootIndex = (ms) => { let acc = 0, i = 0; for (; i < bootDur.length; i++) { acc += bootDur[i]; if (ms < acc) break; } return i; };
  function drawBoot(ms) {
    const i = bootIndex(ms);
    g.imageSmoothingEnabled = false;
    if (boot) {
      const k = boot.frames[Math.min(i, boot.frames.length - 1)];
      g.drawImage(boot.img, (k % boot.cols) * boot.w, Math.floor(k / boot.cols) * boot.h, boot.w, boot.h, 0, 0, W, H);
    }
    lastBoot = i;
    return i >= bootDur.length && bootDur.length > 0;
  }

  // Возвращает true, если картинка изменилась и текстуру надо загрузить заново.
  // Кадр загрузки держится сотни миллисекунд: пока он тот же, холст не трогаем.
  function draw(tSec) {
    clock = tSec;
    const t = tSec - modeStart;
    const wiping = tSec - switchAt >= 0 && tSec - switchAt < WIPE;
    if (mode === 'boot' && !wiping && bootIndex(t * 1000) === lastBoot && bootDur.length) return false;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.fillStyle = BLACK; g.fillRect(0, 0, W, H);
    g.fillStyle = WHITE; g.strokeStyle = WHITE;
    if (mode === 'boot') {
      if (drawBoot(t * 1000)) setMode('menu');
    } else if (mode === 'menu') {
      drawMenu(t);
    } else {
      const p = PROFILES[profile];
      bar(p.id.toUpperCase(), p.icon);
      viz[p.id](t, 0, TOP - 4, W, BOTTOM - TOP + 6);
      g.fillStyle = WHITE; g.strokeStyle = WHITE;
      footer(T.profile, String(profile + 1).padStart(2, '0') + '/' + String(PROFILES.length).padStart(2, '0'));
    }
    // смена экрана: новая картинка проявляется строкой развёртки сверху вниз
    const k = (tSec - switchAt) / WIPE;
    if (k >= 0 && k < 1) {
      const y = H * k;
      g.fillStyle = BLACK; g.fillRect(0, y, W, H - y);
      g.fillStyle = WHITE; g.fillRect(0, y, W, 3);
    }
    return true;
  }

  const WIPE = 0.24;
  let switchAt = -1;
  function setMode(m, idx = 0) {
    if (m === mode && (m !== 'profile' || idx === profile)) return;
    if (mode !== 'boot') switchAt = clock;
    if (m === 'profile' && PROFILES[idx].id === 'retro') doom.reset();
    mode = m; profile = idx; modeStart = clock;
  }

  return { canvas, draw, setMode, setScale, ready, get mode() { return mode; }, get scale() { return scale; } };
}

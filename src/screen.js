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
  ru: { div: '1 µs/дел', m: 'м', cut: 'обрыв', write: 'ЗАПИСЬ', done: 'ГОТОВО', flash: '8 МБ · SPI · 50 МГц',
    width: 'ширина 40 нс', delay: 'задержка 1.2 мкс', profiles: 'ПРОФИЛИ', load: 'F1: ЗАГРУЗИТЬ', profile: '◀ ▶ ПРОФИЛЬ' },
  en: { div: '1 µs/div', m: 'm', cut: 'break', write: 'WRITING', done: 'DONE', flash: '8 MB · SPI · 50 MHz',
    width: 'width 40 ns', delay: 'delay 1.2 µs', profiles: 'PROFILES', load: 'F1: LOAD', profile: '◀ ▶ PROFILE' },
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
    icon('sd', W - 88, 12, 2);
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
      doom.draw(g, t, x, y, w, h, scale);
    },
    neural(t) {
      const layers = [4, 6, 6, 3];
      const pos = layers.map((n, i) => Array.from({ length: n }, (_, j) => [90 + i * 153, TOP + 24 + (j + 0.5) * (330 / n)]));
      const pulse = (t * 1.2) % layers.length;
      for (let i = 0; i < layers.length - 1; i++) {
        const on = Math.floor(pulse) === i;
        for (const a of pos[i]) for (const b of pos[i + 1]) line([a, b], on ? 1.5 : 1, on ? null : [2, 6]);
      }
      pos.forEach((layer, li) => layer.forEach(([x, y]) => {
        g.fillStyle = BLACK; rect(x - 11, y - 11, 22, 22); g.fillStyle = WHITE;
        if (Math.floor(pulse) === li) rect(x - 11, y - 11, 22, 22); else frame(x - 11, y - 11, 22, 22);
      }));
      text('in', 90, 410, 15, 'center'); text('out', 90 + 3 * 153, 410, 15, 'center');
    },
    tdr(t) {
      const x0 = 20, x1 = W - 20, base = 360, refl = 0.62;
      line([[x0, base + 2], [x1, base + 2]], 1, [4, 6]);
      plot(x0, x1, (x) => {
        const u = (x - x0) / (x1 - x0);
        let y = base;
        if (u > 0.08) y = base - 140;
        if (u > refl) y = base - 140 - 80 * Math.exp(-(u - refl) * 30) - 60 * (1 - Math.exp(-(u - refl) * 30));
        return y + Math.sin(u * 200 + t * 10) * (u > 0.08 ? 1.5 : 0);
      }, 2.5, 1);
      const mx = x0 + (x1 - x0) * refl;
      line([[mx, TOP + 12], [mx, base + 20]], 2, Math.floor(t * 2) & 1 ? [6, 6] : null);
      text(`Δ 3.4 ${T.m}`, mx + 12, TOP + 16, 22, 'left', 700);
      text(T.cut, mx + 12, TOP + 46, 16);
      text(`0 ${T.m}`, x0, base + 24, 15); text(`5 ${T.m}`, x1, base + 24, 15, 'right');
    },
    bus(t) {
      const lines = ['I2C  0x48 W  01 60', 'I2C  0x48 R  1F A0', 'SPI  MOSI   9F', 'SPI  MISO   EF 40 17', 'UART RX     "OK\\r\\n"', 'I2C  0x3C W  00 AF', 'SPI  MOSI   03 00 10 00', 'UART TX     "AT+RST"'];
      const off = Math.floor(t * 2.5);
      for (let i = 0; i < 9; i++) {
        const l = lines[(i + off) % lines.length];
        const y = TOP + 16 + i * 38;
        const last = i === 8;
        if (last) { rect(0, y - 8, W, 34); g.fillStyle = BLACK; }
        text(String(((off + i) * 13) % 1000).padStart(3, '0') + ' µs', 16, y, 17);
        text(l, 150, y, 18, 'left', 700);
        g.fillStyle = WHITE;
      }
    },
    programmer(t) {
      const cx = 170, cy = 245;
      frame(cx - 64, cy - 80, 128, 160, 3);
      for (let i = 0; i < 4; i++) { rect(cx - 88, cy - 62 + i * 38, 24, 8); rect(cx + 64, cy - 62 + i * 38, 24, 8); }
      g.beginPath(); g.arc(cx - 40, cy - 56, 7, 0, Math.PI * 2); g.fill();
      text('W25Q', cx, cy - 18, 22, 'center', 700);
      text('64', cx, cy + 10, 22, 'center', 700);
      const p = (t * 0.22) % 1.15;
      const pct = Math.min(100, Math.floor(p * 100));
      text(pct < 100 ? T.write : T.done, 320, 150, 20, 'left', 700);
      text(String(pct) + '%', 320, 184, 48, 'left', 700);
      frame(320, 256, 290, 26, 2);
      rect(326, 262, 278 * Math.min(1, p), 14);
      text(T.flash, 320, 298, 16);
    },
    glitch(t) {
      const x0 = 16, x1 = W - 16, hi = 150, lo = 290, gx = x0 + (x1 - x0) * 0.55;
      const on = (t * 0.8) % 1 > 0.3;
      text('VCC', 16, TOP + 16, 18, 'left', 700);
      line([[x0, hi], [gx - 6, hi], [gx - 6, on ? lo : hi], [gx + 6, on ? lo : hi], [gx + 6, hi], [x1, hi]], 2.5);
      text('CLK', 16, 330, 18, 'left', 700);
      digital(x0, x1, 366, 396, (x) => ((x + t * 80) >> 4) & 1);
      text(T.width, gx + 18, lo - 14, 16);
      text(T.delay, gx + 18, lo + 10, 16);
      line([[x0 + 60, hi - 30], [gx - 6, hi - 30]], 1, [4, 4]);
    },
    terminal(t) {
      const script = ['$ fabbit uart /dev/p2 115200', 'U-Boot 2024.01', 'DRAM:  256 MiB', 'Hit any key to stop autoboot', '=> printenv bootcmd', 'bootcmd=run distro_bootcmd', '=> '];
      let n = Math.floor(t * 24) % 280, y = TOP + 16, cx = 16, cy = y;
      g.font = `500 18px ${MONO}`;
      for (const l of script) {
        if (n <= 0) break;
        const s = l.slice(0, n); n -= l.length;
        text(s, 16, y, 18);
        cx = 16 + Math.ceil(g.measureText(s).width) + 2; cy = y; y += 34;
      }
      if (Math.floor(t * 2.5) & 1) rect(cx, cy, 11, 22);
    },
  };

  function drawMenu(t) {
    bar(T.profiles, 'folder');
    const cols = 3, cw = 196, ch = 122, ox = (W - cols * cw) / 2, oy = TOP + 6;
    const sel = Math.floor(t * 1.1) % PROFILES.length;
    PROFILES.forEach((p, i) => {
      const x = ox + (i % cols) * cw, y = oy + Math.floor(i / cols) * ch;
      if (i === sel) frame(x + 10, y + 4, cw - 20, ch - 8, 3);
      icon(p.id, x + cw / 2 - 24, y + 22, 3);
      text(p.id.toUpperCase(), x + cw / 2, y + 84, 15, 'center', 700);
    });
    footer(T.load, `${sel + 1}/9`);
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
      bar(p.id.toUpperCase(), p.id);
      viz[p.id](t, 0, TOP - 4, W, BOTTOM - TOP + 6);
      g.fillStyle = WHITE; g.strokeStyle = WHITE;
      footer(T.profile, String(profile + 1).padStart(2, '0') + '/09');
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

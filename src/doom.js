// Демо профиля retro: «DOOM на ПЛИС».
// Порядок как у DOS-версии 1993 года: текстовый лог инициализации → титульный экран →
// «таяние» экрана (screen melt, f_wipe.c) → игра со статус-баром.
// Игра рисуется во внутреннем буфере 320×200, как у оригинала, и выводится в 1 бит
// с упорядоченным дизерингом. Графика своя: логотип и спрайты оригинала не используются.

const BW = 320, BH = 200, VIEW_H = 168;           // буфер и высота 3D-вида (32 строки — статус-бар)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const BOOT_LOG = [
  'fabbit> load retro/doom.bit',
  'FPGA configured · 640×480 · 35 Hz',
  '',
  '@DOOM System Startup v1.9',
  'V_Init: allocate screens.',
  'M_LoadDefaults: Load system defaults.',
  'Z_Init: Init zone memory allocation daemon.',
  'W_Init: Init WADfiles.',
  '        adding freedoom1.wad',
  'M_Init: Init miscellaneous info.',
  'R_Init: Init DOOM refresh daemon - [',
  'P_Init: Init Playloop state.',
  'I_Init: Setting up machine state.',
  'D_CheckNetGame: Checking network game status.',
  'S_Init: Setting up sound.',
  'HU_Init: Setting up heads up display.',
  'ST_Init: Init status bar.',
];
const LINE_DT = 0.14;                          // пауза между строками лога, с
const R_DOTS = 14;                             // точки прогресса R_Init
const T_LOG = BOOT_LOG.length * LINE_DT + R_DOTS * 0.05 + 0.5;
const T_TITLE = T_LOG + 2.4;                   // титульник
const TIC = 1 / 35;                            // тик движка

// Карта: кольцевой коридор вокруг центрального блока, колонны по углам.
// 1 — стены-панели, 2 — компьютерный блок, 3 — колонны.
const MAP = [
  '1111111111111111',
  '1..............1',
  '1..............1',
  '1..33......33..1',
  '1..33......33..1',
  '1..............1',
  '1.....2222.....1',
  '1.....2..2.....1',
  '1.....2..2.....1',
  '1.....2222.....1',
  '1..............1',
  '1..33......33..1',
  '1..33......33..1',
  '1..............1',
  '1..............1',
  '1111111111111111',
].map((r) => [...r].map((c) => (c === '.' ? 0 : +c)));
const PATH = [[2, 2], [13.6, 2], [13.6, 13.6], [2, 13.6]];
const BARRELS = [[7.5, 4.2], [4.3, 8.4], [11.6, 8.1], [8.2, 11.8], [5.2, 2.6]];

// Пистолет: '#' — контур, '+' — тёмный металл (дизеринг), '.' — пусто
const GUN = [
  '.......######.......',
  '......#++++++#......',
  '......#+####+#......',
  '......#+#..#+#......',
  '......#+####+#......',
  '......#++++++#......',
  '.....##++++++##.....',
  '.....#++++++++#.....',
  '....##+######+##....',
  '...#++#......#++#...',
  '..#+++#......#+++#..',
  '..#+++########+++#..',
  '.#++++++++++++++++#.',
  '.#++++++++++++++++#.',
  '#++++++++++++++++++#',
  '#++++++++++++++++++#',
];

// Знак Fabbit 16×19 для «лица» в статус-баре; глаза в строках 12–13
const MARK = [
  '.###.......###..', '.###.......###..', '.####....#####..', '.####....#####..',
  '.####....#####..', '.####....#####..', '.####..#####....', '.####..#####....',
  '..##########....', '..############..', '..############..', '################',
  '################', '################', '################', '#######..#######',
  '#######..#######', '..############..', '..############..',
];

// Буквы титула на сетке 5×7
const GLYPH = {
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
};

export function createDoom() {
  const buf = document.createElement('canvas');
  buf.width = BW; buf.height = BH;
  const b = buf.getContext('2d', { willReadFrequently: true });
  const img = b.createImageData(BW, BH);
  const px = img.data;
  const zbuf = new Float32Array(BW);

  // снимки кадров для melt
  const title = new Uint8Array(BW * BH), game = new Uint8Array(BW * BH), out = new Uint8Array(BW * BH);
  let meltY = null, meltTic = 0;

  const put = (arr, x, y, v) => { if (x >= 0 && x < BW && y >= 0 && y < BH) arr[y * BW + x] = v; };
  const dith = (x, y, v) => (v > BAYER[(x & 3) + ((y & 3) << 2)] ? 1 : 0);

  // ── титульный экран ────────────────────────────
  function renderTitle(t, dst) {
    dst.fill(0);
    // фон: редкий дизеринг, «звёзды» ада в 1 бите
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const v = 0.05 + 0.1 * (1 - y / BH);
      dst[y * BW + x] = dith(x, y, v);
    }
    // DOOM: буквы 5×7 клеток, клетка 9×9, заливка с градиентом сверху вниз и тенью
    const word = 'DOOM', cell = 9, gap = 1;
    const w = word.length * (5 + gap) * cell - gap * cell;
    const ox = ((BW - w) / 2) | 0, oy = 34;
    for (let pass = 0; pass < 2; pass++) {
      [...word].forEach((ch, k) => {
        GLYPH[ch].forEach((row, j) => [...row].forEach((c, i) => {
          if (c !== '#') return;
          const x0 = ox + (k * (5 + gap) + i) * cell, y0 = oy + j * cell;
          for (let yy = 0; yy < cell; yy++) for (let xx = 0; xx < cell; xx++) {
            const X = x0 + xx + (pass ? 0 : 3), Y = y0 + yy + (pass ? 0 : 3);
            if (!pass) { put(dst, X, Y, 0); continue; }           // тень
            const edge = xx === 0 || yy === 0;
            const v = edge ? 1 : 1 - (j * cell + yy) / (7 * cell) * 0.75;
            put(dst, X, Y, dith(X, Y, v));
          }
        }));
      });
    }
    // рамка вокруг надписи
    for (let x = ox - 10; x < ox + w + 10; x++) { put(dst, x, oy - 10, 1); put(dst, x, oy + 7 * cell + 10, 1); }
    textInto(dst, 'FPGA GATEWARE PORT', BW / 2, 124, 8, 'center');
    if (Math.floor(t * 2.2) % 2 === 0) textInto(dst, 'PRESS START', BW / 2, 150, 10, 'center');
    textInto(dst, 'FREEDOOM · E1M1', BW / 2, 180, 7, 'center');
  }

  // текст в 1-битный массив: рисуем canvas-текстом на пустом буфере и снимаем порог
  const tcan = document.createElement('canvas'); tcan.width = BW; tcan.height = BH;
  const tg = tcan.getContext('2d', { willReadFrequently: true });
  function textInto(dst, s, x, y, size, align = 'left') {
    tg.clearRect(0, 0, BW, BH);
    tg.font = `700 ${size}px "JetBrains Mono", monospace`;
    tg.textAlign = align; tg.textBaseline = 'top'; tg.fillStyle = '#fff';
    tg.fillText(s, x, y);
    const w = Math.ceil(tg.measureText(s).width) + 4;
    const x0 = Math.max(0, Math.floor(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x) - 2);
    const d = tg.getImageData(x0, y, Math.min(w + 4, BW - x0), size + 4).data;
    const ww = Math.min(w + 4, BW - x0);
    for (let j = 0; j < size + 4; j++) for (let i = 0; i < ww; i++) {
      if (d[(j * ww + i) * 4 + 3] > 110) put(dst, x0 + i, y + j, 1);
    }
  }

  // ── игра: рейкастер ────────────────────────────
  const pathLen = PATH.reduce((s, p, i) => s + Math.hypot(PATH[(i + 1) % 4][0] - p[0], PATH[(i + 1) % 4][1] - p[1]), 0);
  function onPath(s) {
    s = ((s % pathLen) + pathLen) % pathLen;
    for (let i = 0; i < 4; i++) {
      const a = PATH[i], c = PATH[(i + 1) % 4], l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (s <= l) return [a[0] + (c[0] - a[0]) * (s / l), a[1] + (c[1] - a[1]) * (s / l)];
      s -= l;
    }
    return PATH[0];
  }

  function wallTex(type, u, v) {
    if (type === 1) {                                    // панели с заклёпками и полосой
      if (u < 0.05 || u > 0.95) return 0.12;
      if (v > 0.6 && v < 0.67) return 0.9;
      if ((Math.abs(u - 0.15) < 0.03 || Math.abs(u - 0.85) < 0.03) && (Math.abs(v - 0.12) < 0.03 || Math.abs(v - 0.88) < 0.03)) return 1;
      return 0.62 - v * 0.14;
    }
    if (type === 2) {                                    // компьютерный блок: экраны и огоньки
      const cu = (u * 4) % 1, cv = (v * 3) % 1;
      if (cu < 0.08 || cv < 0.08) return 0.1;
      if (cv > 0.35 && cv < 0.6 && cu > 0.2 && cu < 0.8) return 0.95;
      return 0.62;
    }
    return 0.35 + (Math.floor(v * 8) % 2) * 0.12;        // колонны
  }

  function renderGame(t, dst) {
    const speed = 1.9;
    const [pxp, pyp] = onPath(t * speed);
    const [lx, ly] = onPath(t * speed + 1.6);
    const sway = Math.sin(t * 0.9) * 0.18;
    const ang = Math.atan2(ly - pyp, lx - pxp) + sway;
    const dirX = Math.cos(ang), dirY = Math.sin(ang);
    const plX = -dirY * 0.66, plY = dirX * 0.66;
    const bob = Math.sin(t * speed * 5.2) * 2.2;
    const horizon = VIEW_H / 2 + bob * 0.5;
    const flash = (t % 1.7) < 0.08;

    // пол и потолок: построчный кастинг, шахматка на полу, лампы на потолке
    for (let y = 0; y < VIEW_H; y++) {
      const floor = y > horizon;
      const p = floor ? y - horizon : horizon - y;
      const rowD = (VIEW_H * 0.5) / Math.max(p, 0.5);
      const rx0 = dirX - plX, ry0 = dirY - plY, rx1 = dirX + plX, ry1 = dirY + plY;
      let fx = pxp + rowD * rx0, fy = pyp + rowD * ry0;
      const sx = (rowD * (rx1 - rx0)) / BW, sy = (rowD * (ry1 - ry0)) / BW;
      const fog = 1 / (1 + rowD * 0.5);
      for (let x = 0; x < BW; x++) {
        let v;
        if (floor) v = (((Math.floor(fx) + Math.floor(fy)) & 1) ? 0.34 : 0.12) * fog;
        else {
          const lu = fx - Math.floor(fx), lv = fy - Math.floor(fy);
          v = (lu > 0.3 && lu < 0.7 && lv > 0.3 && lv < 0.7 && ((Math.floor(fx) + Math.floor(fy)) % 3 === 0)) ? 0.95 * fog + 0.05 : 0.03;
        }
        if (flash) v *= 1.4;
        dst[y * BW + x] = dith(x, y, v);
        fx += sx; fy += sy;
      }
    }

    // стены: DDA
    for (let x = 0; x < BW; x++) {
      const cam = (2 * x) / BW - 1;
      const rdx = dirX + plX * cam, rdy = dirY + plY * cam;
      let mx = Math.floor(pxp), my = Math.floor(pyp);
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      const stx = rdx < 0 ? -1 : 1, sty = rdy < 0 ? -1 : 1;
      let sdx = (rdx < 0 ? pxp - mx : mx + 1 - pxp) * ddx;
      let sdy = (rdy < 0 ? pyp - my : my + 1 - pyp) * ddy;
      let side = 0, hit = 0;
      for (let k = 0; k < 64 && !hit; k++) {
        if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
        hit = MAP[my]?.[mx] ?? 1;
      }
      const dist = side === 0 ? sdx - ddx : sdy - ddy;
      zbuf[x] = dist;
      const lineH = VIEW_H / dist;
      const top = horizon - lineH / 2, bot = horizon + lineH / 2;
      let u = side === 0 ? pyp + dist * rdy : pxp + dist * rdx;
      u -= Math.floor(u);
      const fog = Math.min(1.25, 1.5 / (1 + dist * 0.28)) * (side ? 0.72 : 1) * (flash ? 1.3 : 1);
      for (let y = Math.max(0, top | 0); y < Math.min(VIEW_H, bot); y++) {
        const v = (y - top) / lineH;
        dst[y * BW + x] = dith(x, y, wallTex(hit, u, v) * fog);
      }
    }

    // бочки: спрайты с z-буфером
    const inv = 1 / (plX * dirY - dirX * plY);
    const spr = BARRELS.map(([sx, sy]) => [sx - pxp, sy - pyp]).sort((a, c) => (c[0] ** 2 + c[1] ** 2) - (a[0] ** 2 + a[1] ** 2));
    for (const [sx, sy] of spr) {
      const tx = inv * (dirY * sx - dirX * sy), ty = inv * (-plY * sx + plX * sy);
      if (ty <= 0.2) continue;
      const scx = (BW / 2) * (1 + tx / ty);
      const h = (VIEW_H / ty) * 0.55, w = h * 0.62;
      const y1 = horizon + VIEW_H / ty / 2, y0 = y1 - h;
      const fog = Math.min(1.25, 1.5 / (1 + ty * 0.28));
      for (let x = Math.max(0, (scx - w / 2) | 0); x < Math.min(BW, scx + w / 2); x++) {
        if (ty > zbuf[x]) continue;
        const u = (x - (scx - w / 2)) / w;
        const round = Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));   // объём цилиндра
        for (let y = Math.max(0, y0 | 0); y < Math.min(VIEW_H, y1); y++) {
          const v = (y - y0) / h;
          let c = 0.25 + 0.55 * round;
          if (Math.abs(v - 0.2) < 0.05 || Math.abs(v - 0.8) < 0.05) c = 0.12;
          if (v < 0.06) c = 0.9;                                          // крышка
          if (u < 0.04 || u > 0.96) c = 1;
          dst[y * BW + x] = dith(x, y, c * fog);
        }
      }
    }

    // оружие: покачивание при ходьбе, отдача при выстреле
    const gs = 3, gw = GUN[0].length * gs;
    const gx = (BW / 2 - gw / 2 + Math.cos(t * speed * 2.6) * 4) | 0;
    const gy = (VIEW_H - GUN.length * gs + 4 + Math.abs(bob) + (flash ? -8 : 0)) | 0;
    if (flash) {                                                // вспышка выстрела
      for (let j = -14; j < 14; j++) for (let i = -14; i < 14; i++) {
        const r = Math.hypot(i, j * 1.2) + (((i * 7 + j * 13) & 3) * 1.5);
        if (r < 12) put(dst, gx + gw / 2 + i, gy - 8 + j, 1);
      }
    }
    GUN.forEach((row, j) => [...row].forEach((c, i) => {
      if (c === '.') return;
      for (let a = 0; a < gs; a++) for (let q = 0; q < gs; q++) {
        const X = gx + i * gs + a, Y = gy + j * gs + q;
        if (Y >= VIEW_H) continue;
        put(dst, X, Y, c === '#' ? 1 : dith(X, Y, 0.3));
      }
    }));

    // прицел не нужен — у DOOM его не было. Сообщение о подборе предмета:
    if ((t % 9) > 5.5 && (t % 9) < 8) textInto(dst, 'Picked up a stimpack.', 4, 4, 7);

    renderStatus(t, dst);
  }

  function renderStatus(t, dst) {
    const y0 = VIEW_H;
    for (let y = y0; y < BH; y++) for (let x = 0; x < BW; x++) dst[y * BW + x] = dith(x, y, 0.18);
    for (let x = 0; x < BW; x++) { put(dst, x, y0, 1); }
    // ячейки: AMMO | HEALTH | ARMS | лицо | ARMOR | запас
    const cells = [[0, 48], [48, 104], [104, 142], [142, 178], [178, 234], [234, 320]];
    for (const [a, c] of cells) {
      for (let y = y0 + 2; y < BH - 1; y++) { put(dst, a + 1, y, 1); put(dst, c - 2, y, 1); }
      for (let x = a + 1; x < c - 1; x++) put(dst, x, BH - 2, 1);
      for (let x = a + 2; x < c - 2; x++) for (let y = y0 + 3; y < BH - 3; y++) put(dst, x, y, 0);
    }
    const ammo = 50 - (Math.floor(t / 1.7) % 50);
    const health = 100 - (Math.floor(t / 4) * 7) % 60;
    textInto(dst, String(ammo), 24, y0 + 4, 14, 'center');
    textInto(dst, 'AMMO', 24, y0 + 21, 6, 'center');
    textInto(dst, health + '%', 76, y0 + 4, 14, 'center');
    textInto(dst, 'HEALTH', 76, y0 + 21, 6, 'center');
    textInto(dst, '2 3 4', 123, y0 + 5, 7, 'center');
    textInto(dst, '5 6 7', 123, y0 + 13, 7, 'center');
    textInto(dst, 'ARMS', 123, y0 + 22, 6, 'center');
    textInto(dst, '0%', 206, y0 + 4, 14, 'center');
    textInto(dst, 'ARMOR', 206, y0 + 21, 6, 'center');
    ['BULL 50/200', 'SHEL  0/50', 'RCKT  0/50', 'CELL  0/300'].forEach((s, i) => textInto(dst, s, 240, y0 + 3 + i * 7, 6));

    // лицо — знак Fabbit, глаза смотрят влево-прямо-вправо
    const look = [0, -1, 0, 1][Math.floor(t / 0.9) % 4];
    const fx = 152, fy = y0 + 7;
    MARK.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') put(dst, fx + i, fy + j, 1); }));
    for (const ex of [3, 11]) for (const ey of [12, 13]) { put(dst, fx + ex + look, fy + ey, 0); put(dst, fx + ex + 1 + look, fy + ey, 0); }
  }

  // ── melt: колонки по 2 пикселя стекают с разной задержкой ──
  function meltStart() {
    const cols = BW / 2;
    meltY = new Int16Array(cols);
    meltY[0] = -(Math.random() * 16 | 0);
    for (let i = 1; i < cols; i++) {
      const r = (Math.random() * 3 | 0) - 1;
      meltY[i] = Math.max(-15, Math.min(0, meltY[i - 1] + r));
    }
    meltTic = 0;
  }
  function meltStep() {
    let done = true;
    for (let i = 0; i < meltY.length; i++) {
      if (meltY[i] < 0) { meltY[i]++; done = false; } else if (meltY[i] < BH) {
        meltY[i] += meltY[i] < 16 ? meltY[i] + 1 : 8; done = false;
      }
    }
    return done;
  }
  function meltCompose(from, to, dst) {
    dst.set(to);
    for (let i = 0; i < meltY.length; i++) {
      const dy = Math.max(0, meltY[i]);
      for (let x = i * 2; x < i * 2 + 2; x++) for (let y = dy; y < BH; y++) dst[y * BW + x] = from[(y - dy) * BW + x];
    }
  }

  function blit(src) {
    for (let i = 0, j = 0; i < src.length; i++, j += 4) {
      const v = src[i] ? 255 : 0;
      px[j] = px[j + 1] = px[j + 2] = v; px[j + 3] = 255;
    }
    b.putImageData(img, 0, 0);
  }

  // Лог загрузки рисуется прямо на экран прибора в высоком разрешении: это текстовый режим.
  function drawLog(g, t, x, y, w, h) {
    const size = 15, lh = 21;
    g.font = `500 ${size}px "JetBrains Mono", monospace`;
    g.textBaseline = 'top'; g.textAlign = 'left';
    let shown = Math.min(BOOT_LOG.length, Math.floor(t / LINE_DT) + 1);
    let yy = y;
    for (let i = 0; i < shown; i++) {
      let s = BOOT_LOG[i];
      if (s.startsWith('@')) {                                // инверсная шапка, как в DOS
        g.fillStyle = '#fff'; g.fillRect(x, yy - 3, w, lh);
        g.fillStyle = '#000'; g.textAlign = 'center'; g.fillText(s.slice(1), x + w / 2, yy);
        g.textAlign = 'left'; g.fillStyle = '#fff';
      } else {
        if (s.endsWith('[')) {
          const dots = Math.max(0, Math.min(R_DOTS, Math.floor((t - i * LINE_DT) / 0.05)));
          s += '.'.repeat(dots) + (dots >= R_DOTS ? ']' : '');
          if (dots < R_DOTS) shown = i + 1;                   // ждём конца прогресса
        }
        g.fillStyle = '#fff'; g.fillText(s, x, yy);
      }
      yy += lh;
      if (yy > y + h - lh) break;
    }
  }

  // t — время с начала показа профиля. Возвращает, что рисовать.
  function draw(g, t, x, y, w, h, scale = 1) {
    if (t < T_LOG) { drawLog(g, t, x, y, w, h); return; }
    if (t < T_TITLE) {
      renderTitle(t, title); blit(title);
    } else {
      const gt = t - T_TITLE;
      if (meltY === null) { renderTitle(t, title); meltStart(); }
      renderGame(gt, game);
      if (meltY) {
        const tics = Math.floor(gt / TIC);
        let done = false;
        while (meltTic < tics && !done) { done = meltStep(); meltTic++; }
        if (done) meltY = false; else { meltCompose(title, game, out); blit(out); }
      }
      if (meltY === false) blit(game);
    }
    // вывод буфера 320×200 целыми «толстыми» пикселями в рамку экрана
    // целое число реальных пикселей на пиксель буфера, иначе «толстые» пиксели плывут
    const k = Math.max(1, Math.floor(Math.min((w * scale) / BW, (h * scale) / BH)));
    const s = k / scale;
    const dw = BW * s, dh = BH * s;
    g.imageSmoothingEnabled = false;
    const snap = (v) => Math.round(v * scale) / scale;
    g.drawImage(buf, snap(x + (w - dw) / 2), snap(y + (h - dh) / 2), dw, dh);
  }

  function reset() { meltY = null; }

  return { draw, reset };
}

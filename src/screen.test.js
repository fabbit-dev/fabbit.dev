import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createScreen, PROFILES } from './screen.js';

// Проверяем публичный рендер каждого ID, а не наличие имён функций в исходнике.
const texts = [];
const context = new Proxy({
  drawImage: vi.fn(),
  fillText: vi.fn((text) => texts.push(text)),
  measureText: (text) => ({ width: text.length * 10 }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
}, {
  get: (target, key) => key in target ? target[key] : () => {},
});

beforeEach(() => {
  texts.length = 0;
  context.drawImage.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  vi.stubGlobal('Image', class {
    set src(_) { queueMicrotask(() => this.onerror()); }
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe.each(['ru', 'en'])('демонстрации экрана (%s)', (lang) => {
  it.each(PROFILES.map((p, i) => [p.id, i]))('рисует %s с пометкой демо и динамическим счётчиком', async (_id, i) => {
    const screen = createScreen({ scale: 1, lang });
    await screen.ready;
    screen.setMode('profile', i);
    expect(() => screen.draw(6)).not.toThrow();
    expect(texts).toContain(lang === 'ru' ? 'ДЕМО' : 'DEMO');
    expect(texts).toContain(`${String(i + 1).padStart(2, '0')}/${String(PROFILES.length).padStart(2, '0')}`);
  });

  it('меню считает записи из каталога, не из старого числа 9', async () => {
    const screen = createScreen({ scale: 1, lang });
    await screen.ready;
    screen.setMode('menu');
    screen.draw(0);
    expect(texts).toContain(`1/${PROFILES.length}`);
    expect(texts).not.toContain('F1: LOAD');
  });

  it('сохраняет размер Doom внутри экрана при смене разрешения текстуры', async () => {
    const screen = createScreen({ scale: 2, lang });
    await screen.ready;
    screen.setMode('profile', PROFILES.findIndex((p) => p.id === 'retro'));
    let reference;
    for (const time of [5, 10]) {
      for (const scale of [2, 1.5, 1.25, 1, 0.75, 0.5]) {
        screen.setScale(scale);
        context.drawImage.mockClear();
        screen.draw(time);
        const [buffer, ...destination] = context.drawImage.mock.calls.find(([image]) => image.width === 320 && image.height === 200);
        expect(buffer).toBeInstanceOf(HTMLCanvasElement);
        reference ??= destination;
        expect(destination).toEqual(reference);
        const [x, y, w, h] = destination;
        expect(w / h).toBeCloseTo(320 / 200);
        expect(x + w / 2).toBeCloseTo(320);
        expect(w).toBeLessThanOrEqual(640);
      }
    }
    expect(reference[1]).toBe(56);
    expect(reference[3]).toBe(378);
  });

  it('пересчитывает оба счётчика при изменении длины каталога', async () => {
    const length = PROFILES.length;
    PROFILES.push({ ...PROFILES[0] }, { ...PROFILES[0] });
    try {
      const screen = createScreen({ scale: 1, lang });
      await screen.ready;
      screen.setMode('menu');
      screen.draw(0);
      expect(texts).toContain(`1/${PROFILES.length}`);
      screen.setMode('profile', PROFILES.length - 1);
      screen.draw(1);
      expect(texts).toContain(`${PROFILES.length}/${PROFILES.length}`);
    } finally {
      PROFILES.splice(length);
    }
  });
});

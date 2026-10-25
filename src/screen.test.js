import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createScreen, PROFILES } from './screen.js';

// Проверяем публичный рендер каждого ID, а не наличие имён функций в исходнике.
const texts = [];
const context = new Proxy({
  fillText: vi.fn((text) => texts.push(text)),
  measureText: (text) => ({ width: text.length * 10 }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
}, {
  get: (target, key) => key in target ? target[key] : () => {},
});

beforeEach(() => {
  texts.length = 0;
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

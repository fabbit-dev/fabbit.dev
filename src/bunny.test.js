import { describe, it, expect, vi } from 'vitest';
import { mountBunny, scene, SCENE_NAMES } from './bunny.js';

// Знак в покое, открытые глаза: первые строки пути (уши) из brand-kit/_source/mark16x20.txt, стоит на y = 1.
const EARS = 'M1 1h3v1h-3zM11 1h3v1h-3z';

const cells = (d) => [...d.matchAll(/M(-?\d+) (-?\d+)h(\d+)/g)].map(([, x, y, w]) => ({ x: +x, y: +y, w: +w }));

describe('сценки зайца', () => {
  it('есть подмигивание, смерть, сон, прыжок и взгляд по сторонам', () => {
    expect(SCENE_NAMES).toEqual(expect.arrayContaining(['wink', 'die', 'sleep', 'hop', 'look']));
  });

  it.each(['wink', 'die', 'sleep', 'hop', 'look', 'blink'])('%s заканчивается в стойке с открытыми глазами', (name) => {
    const frames = scene(name);
    const idle = scene('blink').at(-1).d;
    expect(frames.at(-1).d).toBe(idle);
    expect(idle.startsWith(EARS)).toBe(true);
  });

  it.each(['wink', 'die', 'sleep', 'hop', 'look'])('%s не выходит за сцену по ширине и держит кадры видимыми', (name) => {
    for (const f of scene(name)) {
      expect(f.ms).toBeGreaterThan(0);
      for (const c of cells(f.d)) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(24);
        expect(c.y).toBeLessThan(19);
      }
    }
  });

  it('в смерти заяц лежит на боку: кадр шире, чем выше', () => {
    const lying = scene('die').some((f) => {
      const cs = cells(f.d);
      const w = Math.max(...cs.map((c) => c.x + c.w)) - Math.min(...cs.map((c) => c.x));
      const h = Math.max(...cs.map((c) => c.y)) - Math.min(...cs.map((c) => c.y)) + 1;
      return w > h;
    });
    expect(lying).toBe(true);
  });
});

describe('mountBunny', () => {
  it('при reduced motion рисует статичного зайца и не заводит таймеры', () => {
    vi.useFakeTimers();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mountBunny(svg, { reduced: true });
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 19');
    expect(svg.querySelector('path').getAttribute('d').startsWith(EARS)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe('кнопка зайца', () => {
  it('при reduced motion убирается из фокуса и скрывается от скринридера', () => {
    const btn = document.createElement('button');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    btn.append(svg);
    mountBunny(svg, { reduced: true, trigger: btn });
    expect(btn.tabIndex).toBe(-1);
    expect(btn.getAttribute('aria-hidden')).toBe('true');
  });
});

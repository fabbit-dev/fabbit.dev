import { describe, it, expect, vi } from 'vitest';
import { highFive, mountHighFive, HF_W, HF_H } from './highfive.js';

const cells = (d) => [...d.matchAll(/M(-?\d+) (-?\d+)h(\d+)/g)].map(([, x, y, w]) => ({ x: +x, y: +y, w: +w }));

describe('человечки дают пять', () => {
  it('в цикле есть хлопок, и цикл замкнут: последний кадр совпадает с первым', () => {
    const f = highFive();
    expect(f.some((x) => x.name === 'clap')).toBe(true);
    expect(f.at(-1).d).toBe(f[0].d);
  });

  it('в кадре хлопка ладони сходятся посередине сцены', () => {
    const clap = highFive().find((x) => x.name === 'clap');
    const mid = HF_W / 2;
    const top = cells(clap.d).filter((c) => c.x <= mid && c.x + c.w >= mid);
    expect(top.length).toBeGreaterThan(0);
  });

  it('все кадры внутри сцены и с положительной длительностью', () => {
    for (const f of highFive()) {
      expect(f.ms).toBeGreaterThan(0);
      for (const c of cells(f.d)) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(HF_W);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeLessThan(HF_H);
      }
    }
  });

  it('при reduced motion показывает хлопок и не заводит таймеры', () => {
    vi.useFakeTimers();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mountHighFive(svg, { reduced: true });
    const clap = highFive().find((x) => x.name === 'clap');
    expect(svg.querySelector('path').getAttribute('d')).toBe(clap.d);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

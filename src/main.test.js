import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';

const { triggers } = vi.hoisted(() => ({ triggers: [] }));
vi.mock('gsap', () => ({ default: {
  registerPlugin: vi.fn(), matchMedia: () => ({ add: vi.fn() }),
} }));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {
  create: (options) => { triggers.push(options); return { isActive: false }; },
  refresh: vi.fn(), addEventListener: vi.fn(),
  config: vi.fn(),
} }));

it('без WebGL профили выбираются кнопками, а не длиной 3D-главы', async () => {
  const html = readFileSync('index.html', 'utf8');
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)[1];
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.stubGlobal('IntersectionObserver', class { observe() {} });
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  try {
    await import('./main.js');
    expect(document.documentElement.classList.contains('no-gl')).toBe(true);
    const current = document.querySelector('#pcur');
    const next = document.querySelector('.pmeta__step[data-step="1"]');
    next.click();
    expect(current.textContent).toBe('02');
    expect(document.querySelector('#plist li[aria-current]')?.dataset.i).toBe('1');
    // ScrollTrigger после refresh/resize не должен сбрасывать ручной выбор.
    triggers.find((t) => t.trigger === '#profiles').onUpdate({ progress: 0 });
    expect(current.textContent).toBe('02');
    document.querySelector('.pmeta__step[data-step="-1"]').click();
    expect(current.textContent).toBe('01');
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});

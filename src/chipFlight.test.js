import { describe, it, expect, vi } from 'vitest';
import { mountChipFlights } from './chipFlight.js';

describe('анимация чипа в карточке ПЛИС', () => {
  it('идёт, только пока плитка на экране', () => {
    let fire;
    vi.stubGlobal('IntersectionObserver', class { constructor(cb) { fire = cb; } observe() {} disconnect() {} });
    document.body.innerHTML = '<div data-flight data-running="false"></div>';
    mountChipFlights(document);
    const el = document.querySelector('[data-flight]');
    fire([{ target: el, isIntersecting: true }]);
    expect(el.dataset.running).toBe('true');
    fire([{ target: el, isIntersecting: false }]);
    expect(el.dataset.running).toBe('false');
    vi.unstubAllGlobals();
  });
});

import { describe, it, expect } from 'vitest';
import { renderBuild } from './render.jsx';
import { PARTS } from './parts.js';

// Глава «Начинка» рендерится в HTML при сборке: в браузер React не едет.
describe('renderBuild', () => {
  it.each(['ru', 'en'])('отдаёт готовую разметку главы с отдельным радио (%s)', (lang) => {
    const doc = new DOMParser().parseFromString(`<section>${renderBuild(lang)}</section>`, 'text/html');
    expect(doc.querySelector('h2#how-title').textContent).toMatch(lang === 'ru' ? /Внутри\s*Fabbit/ : /Inside\s*Fabbit/);
    expect(doc.querySelectorAll('article').length).toBe(PARTS.length);
    expect(doc.querySelector('#part-mcu').textContent).toContain('CH32H417');
    expect(doc.querySelector('#part-radio').textContent).toContain('ESP32-C5');
    expect(doc.querySelector('.build__status')).toBeNull();
    expect(doc.querySelector('#part-fpga [data-flight]')).not.toBeNull();   // чип с анимацией, её включает main.js
  });
});

import { describe, it, expect } from 'vitest';
import { renderBuild } from './render.jsx';

// Глава «Начинка» рендерится в HTML при сборке: в браузер React не едет.
describe('renderBuild', () => {
  it('отдаёт готовую разметку главы: заголовок и восемь карточек частей', () => {
    const doc = new DOMParser().parseFromString(`<section>${renderBuild()}</section>`, 'text/html');
    expect(doc.querySelector('h2#how-title').textContent).toMatch(/Внутри\s*Fabbit/);
    expect(doc.querySelectorAll('article').length).toBe(8);
    expect(doc.querySelector('#part-fpga [data-flight]')).not.toBeNull();   // чип с анимацией, её включает main.js
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// обе версии: русская в корне и английская в /en/
describe.each([
  ['index.html', 'Меню'],
  ['en/index.html', 'Menu'],
])('семантика страницы %s', (file, menuLabel) => {
  let doc;
  beforeAll(() => {
    doc = new DOMParser().parseFromString(readFileSync(resolve(process.cwd(), file), 'utf8'), 'text/html');
  });

  it('каждая глава подписана своим заголовком h2', () => {
    const sections = [...doc.querySelectorAll('main section[id]')];
    expect(sections.length).toBeGreaterThan(5);
    for (const s of sections) {
      const id = s.getAttribute('aria-labelledby');
      expect(id, s.id).toBeTruthy();
      if (s.id === 'how') continue; // заголовок рисует React-остров, проверяется в Build.test.jsx
      const h = doc.getElementById(id);
      expect(h?.tagName, s.id).toMatch(/^H[12]$/);
    }
  });

  it('ссылка «К содержанию» ведёт на main, куда можно поставить фокус', () => {
    expect(doc.querySelector('.skip').getAttribute('href')).toBe('#main');
    expect(doc.querySelector('main#main').getAttribute('tabindex')).toBe('-1');
  });

  it('на телефоне есть кнопка меню, связанная с диалогом разделов', () => {
    const btn = doc.querySelector('.nav__menu');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe(menuLabel);   // кнопка-иконка без текста
    const panel = doc.getElementById(btn.getAttribute('aria-controls'));
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.hasAttribute('hidden')).toBe(true);
    const hrefs = [...panel.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['#profiles', '#device', '#how', '#team']));
  });

  it('стрелки в подписях не читаются вслух', () => {
    for (const el of doc.querySelectorAll('a, button')) {
      for (const node of el.childNodes) {
        if (node.nodeType === 3) expect(node.textContent, el.outerHTML).not.toMatch(/[↓↑→←]/);
      }
    }
  });

  it('у Open Graph абсолютные адреса', () => {
    expect(doc.querySelector('meta[property="og:image"]').content).toMatch(/^https:\/\//);
    expect(doc.querySelector('meta[property="og:url"]').content).toMatch(/^https:\/\//);
    expect(doc.querySelector('meta[property="og:type"]').content).toBe('website');
  });
});

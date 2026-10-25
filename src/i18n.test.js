import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { pick, pickStartLang } from './i18n.js';
import { PROFILES } from './profiles.js';
import { PARTS } from './build/parts.js';
import { CALLOUTS } from './scene.js';
import { SCREEN_TXT } from './screen.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
const parse = (f) => new DOMParser().parseFromString(read(f), 'text/html');
const ru = parse('index.html'), en = parse('en/index.html');
const CYR = /[А-Яа-яЁё]/;

// «Скелет» страницы: теги, id, классы и якоря по порядку. Тексты в сравнение не входят.
const skeleton = (doc) => [...doc.body.querySelectorAll('*')]
  .filter((el) => !el.classList.contains('nav__lang'))
  .map((el) => [el.tagName, el.id, el.className?.baseVal ?? el.className, (el.getAttribute('href') ?? '').startsWith('#') ? el.getAttribute('href') : ''].join('|'));

describe('две версии сайта', () => {
  it('разметка русской и английской страниц совпадает, различаются только тексты', () => {
    expect(skeleton(en)).toEqual(skeleton(ru));
  });

  it('язык страниц и ссылки hreflang', () => {
    expect(ru.documentElement.lang).toBe('ru');
    expect(en.documentElement.lang).toBe('en');
    for (const doc of [ru, en]) {
      const alt = Object.fromEntries([...doc.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.hreflang, l.href]));
      expect(alt).toEqual({ ru: 'https://fabbit.dev/', en: 'https://fabbit.dev/en/', 'x-default': 'https://fabbit.dev/' });
    }
    expect(ru.querySelector('link[rel="canonical"]').href).toBe('https://fabbit.dev/');
    expect(en.querySelector('link[rel="canonical"]').href).toBe('https://fabbit.dev/en/');
    expect(en.querySelector('meta[property="og:url"]').content).toBe('https://fabbit.dev/en/');
  });

  it('переключатель ведёт в другую версию', () => {
    expect(ru.querySelector('.nav__lang').getAttribute('href')).toBe('/en/');
    expect(en.querySelector('.nav__lang').getAttribute('href')).toBe('/');
  });

  it('в английской странице нет кириллицы, кроме подписи переключателя на русский', () => {
    const clone = en.body.cloneNode(true);
    clone.querySelectorAll('[lang="ru"]').forEach((el) => el.remove());
    const walker = en.createTreeWalker(clone, 4 /* SHOW_TEXT */);
    const bad = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (CYR.test(n.textContent)) bad.push(n.textContent.trim());
    for (const el of clone.querySelectorAll('[aria-label], [alt]')) {
      for (const a of ['aria-label', 'alt']) if (CYR.test(el.getAttribute(a) ?? '')) bad.push(el.getAttribute(a));
    }
    expect(bad).toEqual([]);
    expect(CYR.test(en.title + en.querySelector('meta[name="description"]').content)).toBe(false);
  });

  it('на первом экране обозначает разработку, в выносках нет старого MCU', () => {
    expect(ru.querySelector('.hero__lead').textContent).toMatch(/^Разрабатываем/);
    expect(en.querySelector('.hero__lead').textContent).toMatch(/^We’re developing/);
    expect(JSON.stringify(CALLOUTS)).not.toContain('ESP32-C3');
    const pcb = CALLOUTS.find((c) => c.groups.includes('PCB'));
    expect(pick(pcb.sub, 'ru')).toContain('схемы пока нет');
    expect(pick(pcb.sub, 'en')).toContain('no schematic yet');
  });

  it('автоопределение языка стоит только в корне', () => {
    expect(read('index.html')).toContain("location.replace('/en/'");
    expect(read('en/index.html')).not.toContain('location.replace');
  });
});

// подстраницы донатов: «Траты» и «Спасибо» (successURL ЮMoney)
describe.each(['spent', 'thanks'])('подстраница %s', (page) => {
  const pr = parse(`${page}/index.html`), pe = parse(`en/${page}/index.html`);
  it('разметка ru и en совпадает', () => expect(skeleton(pe)).toEqual(skeleton(pr)));
  it('язык, переключатель и canonical', () => {
    expect(pr.documentElement.lang).toBe('ru');
    expect(pe.documentElement.lang).toBe('en');
    expect(pr.querySelector('.nav__lang').getAttribute('href')).toBe(`/en/${page}/`);
    expect(pe.querySelector('.nav__lang').getAttribute('href')).toBe(`/${page}/`);
  });
  it('в английской нет кириллицы', () => {
    const clone = pe.body.cloneNode(true);
    clone.querySelectorAll('[lang="ru"]').forEach((el) => el.remove());
    expect(CYR.test(clone.textContent + pe.title)).toBe(false);
  });
});

describe('донаты на главной', () => {
  it.each([[ru, '/thanks/'], [en, '/en/thanks/']])('форма ведёт в ЮMoney и возвращает на «Спасибо»', (doc, back) => {
    const f = doc.getElementById('donate-form');
    expect(f.getAttribute('action')).toBe('https://yoomoney.ru/quickpay/confirm');
    expect(f.getAttribute('method')).toBe('POST');
    expect(f.elements.receiver.value).toBe('4100119646671169');
    expect(f.elements.successURL.value).toBe(`https://fabbit.dev${back}`);
    // имя и сообщение уходят в воркер, не в ЮMoney: у полей нет name
    expect(f.querySelector('[data-name]').hasAttribute('name')).toBe(false);
    expect(f.querySelector('[data-message]').hasAttribute('name')).toBe(false);
    // карту или кошелёк посетитель выбирает на странице ЮMoney
    expect(f.querySelectorAll('[name="paymentType"]')).toHaveLength(1);
    expect(f.elements.paymentType.type).toBe('hidden');
    expect([...f.querySelectorAll('[data-sum]')].map((b) => b.dataset.sum)).toEqual(['300', '500', '1000', '5000']);
    expect(f.elements.sum.value).toBe('500');
  });

  it.each([[ru, '/spent/'], [en, '/en/spent/']])('на траты из главы ведёт одна ссылка', (doc, href) => {
    expect([...doc.querySelectorAll('#support a')].map((a) => a.getAttribute('href'))).toEqual([href]);
  });

  it.each([ru, en])('в хиро кнопка «Поддержать» ведёт на главу', (doc) => {
    const hrefs = [...doc.querySelectorAll('.hero .actions a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('#support');
    expect(hrefs).not.toContain('#profiles');
  });
});

describe('двуязычные данные', () => {
  const both = (v, where) => {
    for (const lang of ['ru', 'en']) {
      const t = pick(v, lang);
      expect(typeof t === 'string' && (t.length > 0 || v === ''), `${where} ${lang}`).toBe(true);
      if (lang === 'en') expect(t, where).not.toMatch(CYR);
    }
  };
  it('профили', () => PROFILES.forEach((p) => { both(p.name, p.id); both(p.desc, p.id); }));
  it('детали «Начинки»', () => PARTS.forEach((p) => {
    both(p.title, p.id); both(p.what, p.id);
    p.specs.flat().forEach((v) => both(v, p.id));
    (p.tag ?? []).forEach((v) => both(v, p.id));
    if (p.note) both(p.note, p.id);
  }));
  it('выноски на модели', () => CALLOUTS.forEach((c) => { both(c.title, c.groups[0]); both(c.sub, c.groups[0]); }));
  it('надписи экрана прибора', () => {
    expect(Object.keys(SCREEN_TXT.en)).toEqual(Object.keys(SCREEN_TXT.ru));
    Object.values(SCREEN_TXT.en).forEach((t) => expect(t).not.toMatch(CYR));
  });
});

// Инлайн-скрипт в <head> index.html выполняется в «браузере» с подставными location/navigator/localStorage.
function runInline({ path = '/', saved = null, languages = [], ua = '' }) {
  const src = read('index.html').match(/<script>(\(function\(\)\{try\{if\(location\.pathname.*?)<\/script>/s)[1];
  let went = null;
  vm.runInNewContext(src, {
    location: { pathname: path, hash: '', replace: (u) => { went = u; } },
    navigator: { languages, language: languages[0] ?? '', userAgent: ua },
    localStorage: { getItem: () => saved },
  });
  return went;
}

describe('автоопределение языка', () => {
  const cases = [
    { name: 'русский браузер', languages: ['ru-RU', 'ru'], want: 'ru' },
    { name: 'английская ОС, русский вторым', languages: ['en-US', 'ru'], want: 'ru' },
    { name: 'только немецкий', languages: ['de-DE'], want: 'en' },
    { name: 'только английский', languages: ['en-US', 'en'], want: 'en' },
    { name: 'поисковый робот', languages: ['en-US'], ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)', want: 'ru' },
    { name: 'выбрал английский сам', languages: ['ru-RU'], saved: 'en', want: 'en' },
    { name: 'выбрал русский сам', languages: ['en-US'], saved: 'ru', want: 'ru' },
  ];
  it.each(cases)('$name → $want', (c) => {
    expect(pickStartLang({ path: '/', ...c })).toBe(c.want);
    expect(runInline(c)).toBe(c.want === 'en' ? '/en/' : null);
  });
  it('на /en/ и других путях не переадресует', () => {
    expect(pickStartLang({ path: '/en/', languages: ['de'] })).toBe(null);
    expect(runInline({ path: '/en/', languages: ['de'] })).toBe(null);
  });
});

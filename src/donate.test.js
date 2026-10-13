import { describe, it, expect, vi } from 'vitest';
import { quickpayFields, parseSum, formatRub, renderStats, mountDonate, renderExpenses } from './donate.js';

const NB = ' ';
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('форма ЮMoney', () => {
  it('поля quickpay для английской страницы; карту или кошелёк посетитель выбирает у ЮMoney', () => {
    expect(quickpayFields({ sum: 300, label: 'abc', lang: 'en' })).toEqual({
      receiver: '4100119646671169',
      'quickpay-form': 'button',
      paymentType: 'AC',
      sum: '300',
      label: 'abc',
      successURL: 'https://fabbit.dev/en/thanks/',
    });
  });

  it('русская страница возвращает на /thanks/', () => {
    expect(quickpayFields({ sum: 100, label: '', lang: 'ru' }).successURL).toBe('https://fabbit.dev/thanks/');
  });

  it.each([
    ['100', 100], [' 1 000 ', 1000], ['15000', 15000], ['15001', null], ['99', null], ['150.5', null], ['', null], ['abc', null],
  ])('сумма «%s» → %s', (s, want) => expect(parseSum(s)).toBe(want));
});

describe('рубли', () => {
  it.each([
    [10000, 'ru', `100${NB}₽`],
    [55050, 'ru', `550,50${NB}₽`],
    [123400000, 'ru', `1${NB}234${NB}000${NB}₽`],
    [123450, 'en', `1,234.50${NB}₽`],
  ])('%i коп. (%s) → %s', (kop, lang, want) => expect(formatRub(kop, lang)).toBe(want));
});

function statsDom() {
  document.body.innerHTML = `
    <div id="s">
      <p data-total></p>
      <button type="button" data-sort="top" aria-pressed="true">top</button>
      <button type="button" data-sort="recent" aria-pressed="false">recent</button>
      <ol data-list></ol>
      <button type="button" data-more hidden>more</button>
      <p data-error hidden>error</p>
    </div>`;
  return document.getElementById('s');
}

const TOP = {
  total_kop: 65050, count: 3, sort: 'top', page: 0, more: false,
  items: [
    { name: '<img src=x onerror=alert(1)>', anon: null, amount_kop: 55050 },
    { name: 'Боря', anon: null, amount_kop: 10000 },
    { name: null, anon: 'A3F9', amount_kop: 100 },
  ],
};
const RECENT = {
  total_kop: 65050, count: 3, sort: 'recent', page: 0, more: false,
  items: [
    { name: null, anon: 'A3F9', message: null, amount_kop: 100, at: '2026-10-13T10:00:00Z' },
    { name: 'Боря', anon: null, message: '<b>жирно</b>', amount_kop: 10000, at: '2026-10-12T10:00:00Z' },
  ],
};
const texts = (root) => [...root.querySelectorAll('[data-list] li')].map((li) => li.textContent);

describe('статистика', () => {
  it('топ: итог и донатеры; HTML из имён выводится текстом', () => {
    const root = statsDom();
    renderStats(root, TOP, 'ru');
    expect(root.querySelector('[data-total]').textContent).toBe(`650,50${NB}₽`);
    expect(texts(root)).toEqual([`<img src=x onerror=alert(1)>550,50${NB}₽`, `Боря100${NB}₽`, `Аноним #A3F91${NB}₽`]);
    expect(root.querySelector('img, b')).toBe(null);
    expect(root.querySelector('[data-more]').hidden).toBe(true);
  });

  it('недавние: аноним подписан, сообщение текстом', () => {
    const root = statsDom();
    renderStats(root, RECENT, 'ru');
    expect(texts(root)[0]).toContain('Аноним #A3F9');
    expect(texts(root)[1]).toContain('<b>жирно</b>');
    expect(root.querySelector('b')).toBe(null);
    renderStats(root, RECENT, 'en');
    expect(texts(root)[0]).toContain('Anonymous #A3F9');
  });

  it('переключатель: «Недавние» грузит свой список, «Показать ещё» дописывает страницу', async () => {
    const root = statsDom();
    const fetchJson = vi.fn(async (path) => ({
      '/stats?sort=top&page=0': TOP,
      '/stats?sort=recent&page=0': { ...RECENT, more: true },
      '/stats?sort=recent&page=1': { ...RECENT, page: 1, items: [{ name: 'Вера', anon: null, message: null, amount_kop: 500, at: '2026-10-01T00:00:00Z' }] },
    })[path]);
    mountDonate({ stats: root, fetchJson, lang: 'ru' });
    await flush();
    expect(texts(root)).toHaveLength(3);
    const [top, recent] = root.querySelectorAll('[data-sort]');
    recent.click();
    await flush();
    expect(recent.getAttribute('aria-pressed')).toBe('true');
    expect(top.getAttribute('aria-pressed')).toBe('false');
    expect(texts(root)[0]).toContain('Аноним');
    const more = root.querySelector('[data-more]');
    expect(more.hidden).toBe(false);
    more.click();
    await flush();
    expect(texts(root)).toHaveLength(3);
    expect(more.hidden).toBe(true);
    top.click();
    await flush();
    expect(texts(root)[1]).toBe(`Боря100${NB}₽`);
    expect(fetchJson.mock.calls.map((c) => c[0])).toEqual([
      '/stats?sort=top&page=0', '/stats?sort=recent&page=0', '/stats?sort=recent&page=1', '/stats?sort=top&page=0',
    ]);
  });

  it('воркер недоступен: видна ошибка, итога нет', async () => {
    const root = statsDom();
    mountDonate({ stats: root, fetchJson: () => Promise.reject(new Error('blocked')), lang: 'ru' });
    await flush();
    expect(root.querySelector('[data-error]').hidden).toBe(false);
    expect(root.querySelector('[data-total]').textContent).toBe('');
  });
});

function formDom() {
  document.body.innerHTML = `
    <form id="f" action="https://yoomoney.ru/quickpay/confirm" method="POST">
      <input type="hidden" name="receiver" value="4100119646671169">
      <input type="hidden" name="quickpay-form" value="button">
      <input type="hidden" name="label" value="">
      <input type="hidden" name="successURL" value="https://fabbit.dev/thanks/">
      <input name="sum" value="300">
      <button type="button" data-sum="100">100</button>
      <button type="button" data-sum="300">300</button>
      <input id="dn" data-name>
      <textarea data-message></textarea>
      <input type="hidden" name="paymentType" value="AC">
      <p data-sum-error hidden></p>
      <button type="submit">pay</button>
    </form>`;
  const form = document.getElementById('f');
  form.submit = vi.fn();
  return form;
}

describe('отправка формы', () => {
  it('быстрая кнопка ставит сумму и отмечается выбранной; своя сумма снимает отметку', () => {
    const form = formDom();
    mountDonate({ form, fetchJson: vi.fn(), lang: 'ru' });
    const b = form.querySelector('[data-sum="300"]');
    expect(b.getAttribute('aria-pressed')).toBe('true');   // в поле уже 300 из разметки
    form.elements.sum.value = '';
    form.elements.sum.dispatchEvent(new Event('input'));
    expect(b.getAttribute('aria-pressed')).toBe('false');
    b.click();
    expect(form.elements.sum.value).toBe('300');
    expect(b.getAttribute('aria-pressed')).toBe('true');
  });

  it('заявка в воркер, label в форму, переход на ЮMoney', async () => {
    const form = formDom();
    const fetchJson = vi.fn().mockResolvedValue({ label: 'L-1' });
    mountDonate({ form, fetchJson, lang: 'ru' });
    form.elements.sum.value = '500';
    form.querySelector('[data-name]').value = 'Петя';
    form.querySelector('[data-message]').value = 'Удачи';
    form.requestSubmit();
    await flush();
    expect(fetchJson).toHaveBeenCalledWith('/register', { name: 'Петя', message: 'Удачи' });
    expect(form.elements.label.value).toBe('L-1');
    expect(form.submit).toHaveBeenCalledOnce();
  });

  it('воркер недоступен: оплата всё равно идёт, без label', async () => {
    const form = formDom();
    mountDonate({ form, fetchJson: () => Promise.reject(new Error('blocked')), lang: 'ru' });
    form.elements.sum.value = '100';
    form.requestSubmit();
    await flush();
    expect(form.elements.label.value).toBe('');
    expect(form.submit).toHaveBeenCalledOnce();
  });

  it('сумма меньше 100 ₽: форма не уходит, видна подсказка', async () => {
    const form = formDom();
    const fetchJson = vi.fn();
    mountDonate({ form, fetchJson, lang: 'ru' });
    form.elements.sum.value = '50';
    form.requestSubmit();
    await flush();
    expect(fetchJson).not.toHaveBeenCalled();
    expect(form.submit).not.toHaveBeenCalled();
    expect(form.querySelector('[data-sum-error]').hidden).toBe(false);
  });
});

describe('траты', () => {
  function spentDom() {
    document.body.innerHTML = `
      <div id="x">
        <b data-raised></b><b data-spent></b><b data-left></b>
        <table><tbody data-rows></tbody></table>
        <p data-empty hidden></p>
      </div>`;
    return document.getElementById('x');
  }
  const EXPENSES = [
    { date: '2026-10-01', what: { ru: 'АЦП <AD9288>', en: 'ADC <AD9288>' }, amount: 1234.5, url: 'https://example.com/r/1' },
    { date: '2026-10-05', what: { ru: 'Плата', en: 'Board' }, amount: 500, url: 'javascript:alert(1)' },
  ];

  it('итоги, строки по дате (новые сверху), ссылки только http(s)', () => {
    const root = spentDom();
    renderExpenses(root, EXPENSES, 300000, 'ru');
    expect(root.querySelector('[data-raised]').textContent).toBe(`3${NB}000${NB}₽`);
    expect(root.querySelector('[data-spent]').textContent).toBe(`1${NB}734,50${NB}₽`);
    expect(root.querySelector('[data-left]').textContent).toBe(`1${NB}265,50${NB}₽`);
    const rows = [...root.querySelectorAll('[data-rows] tr')];
    expect(rows[0].textContent).toContain('Плата');
    expect(rows[1].textContent).toContain('АЦП <AD9288>');
    expect(rows[0].querySelector('a')).toBe(null);
    expect(rows[1].querySelector('a').href).toBe('https://example.com/r/1');
    expect(rows[1].querySelector('a').rel).toBe('noopener');
    expect(root.querySelector('[data-empty]').hidden).toBe(true);
  });

  it('без статистики воркера: собрано и остаток — прочерк', () => {
    const root = spentDom();
    renderExpenses(root, EXPENSES, null, 'en');
    expect(root.querySelector('[data-raised]').textContent).toBe('—');
    expect(root.querySelector('[data-left]').textContent).toBe('—');
    expect(root.querySelector('[data-rows] tr').textContent).toContain('Board');
  });

  it('трат нет: сообщение', () => {
    const root = spentDom();
    renderExpenses(root, [], 0, 'ru');
    expect(root.querySelector('[data-empty]').hidden).toBe(false);
  });
});

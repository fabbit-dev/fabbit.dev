// Донаты через ЮMoney: форма quickpay, статистика из воркера donate.fabbit.dev (worker/), траты.
// Тексты от посетителей (имена, сообщения) и из expenses.json выводятся только через textContent.
import { LANG, pick } from './i18n.js';

export const API = import.meta.env?.VITE_DONATE_API ?? 'https://donate.fabbit.dev';
const RECEIVER = '4100119646671169';
const SUM_MIN = 100, SUM_MAX = 15_000;   // ЮMoney: перевод на кошелёк до 15 000 ₽
const NB = ' ';
const T = {
  anon: { ru: 'Аноним', en: 'Anonymous' },
  receipt: { ru: 'Чек', en: 'Receipt' },
};

// Поля формы https://yoomoney.ru/quickpay/confirm (документация: yoomoney.ru/docs/payment-buttons/using-api/forms).
// paymentType обязателен; AC открывает оплату картой, кошелёк посетитель выбирает там же, у ЮMoney.
export function quickpayFields({ sum, label, lang = LANG }) {
  return {
    receiver: RECEIVER,
    'quickpay-form': 'button',
    paymentType: 'AC',
    sum: String(sum),
    label,
    successURL: `https://fabbit.dev${lang === 'en' ? '/en' : ''}/thanks/`,
  };
}

// Сумма из поля: целые рубли от 100 до 15 000, пробелы между разрядами допустимы. Иначе null.
export function parseSum(s) {
  const t = String(s).replace(/\s/g, '');
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= SUM_MIN && n <= SUM_MAX ? n : null;
}

// Копейки → «1 234,50 ₽» / «1,234.50 ₽»; копейки показываем, только если они есть
export function formatRub(kop, lang = LANG) {
  const frac = kop % 100 ? 2 : 0;
  const n = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU', { minimumFractionDigits: frac, maximumFractionDigits: frac })
    .format(kop / 100).replace(/\s/g, NB);
  return `${n}${NB}₽`;
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// Строка ведомости: имя ……… сумма; у недавних донатов сообщение строкой ниже
function item({ name, anon, message, amount_kop }, lang) {
  const li = el('li', 'entry');
  li.append(
    el('span', 'entry__name', name ?? `${pick(T.anon, lang)} #${anon}`),
    el('span', 'entry__sum', formatRub(amount_kop, lang)),
  );
  if (message) li.append(el('p', 'entry__msg', message));
  return li;
}

// Ответ GET /stats → разметка. page > 0 дописывает строки к уже показанным.
export function renderStats(root, data, lang = LANG) {
  root.querySelector('[data-total]').textContent = formatRub(data.total_kop, lang);
  const list = root.querySelector('[data-list]');
  const items = data.items.map((d) => item(d, lang));
  if (data.page > 0) list.append(...items); else list.replaceChildren(...items);
  root.querySelector('[data-more]').hidden = !data.more;
}

// Запрос к воркеру: без body GET, с body POST JSON. Через 5 с отказ: оплата не ждёт заблокированный Cloudflare.
export async function fetchJson(path, body) {
  const res = await fetch(API + path, body === undefined
    ? { signal: AbortSignal.timeout(5000) }
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// Переключатель «Топ / Недавние» и «Показать ещё». Ответ, пришедший после смены вкладки, отбрасывается.
function mountStats(root, get, lang) {
  let sort = 'top', page = 0, seq = 0;
  const tabs = [...root.querySelectorAll('[data-sort]')];
  const more = root.querySelector('[data-more]');
  const load = () => {
    const my = ++seq;
    return get(`/stats?sort=${sort}&page=${page}`).then((d) => { if (my === seq) renderStats(root, d, lang); });
  };
  load().catch(() => { root.querySelector('[data-error]').hidden = false; });
  tabs.forEach((t) => t.addEventListener('click', () => {
    if (t.dataset.sort === sort) return;
    sort = t.dataset.sort;
    page = 0;
    tabs.forEach((x) => x.setAttribute('aria-pressed', String(x === t)));
    load().catch(() => {});
  }));
  more.addEventListener('click', () => {
    more.disabled = true;
    page += 1;
    load().catch(() => { page -= 1; }).finally(() => { more.disabled = false; });
  });
}

// Без JS форма уходит в ЮMoney сама, донат анонимный. С JS сначала заявка в воркер:
// имя и сообщение остаются у нас, в ЮMoney уходит только label.
function mountForm(form, get, lang) {
  const sum = form.elements.sum;
  const err = form.querySelector('[data-sum-error]');
  const quick = [...form.querySelectorAll('[data-sum]')];
  // быстрая сумма, совпавшая с полем, отмечена выбранной
  const mark = () => quick.forEach((b) => b.setAttribute('aria-pressed', String(parseSum(sum.value) === Number(b.dataset.sum))));
  quick.forEach((b) => b.addEventListener('click', () => {
    sum.value = b.dataset.sum;
    err.hidden = true;
    mark();
  }));
  sum.addEventListener('input', () => { err.hidden = true; mark(); });
  mark();
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = parseSum(sum.value);
    if (n === null) { err.hidden = false; sum.focus(); return; }
    if (busy) return;
    busy = true;
    sum.value = String(n);
    const name = form.querySelector('[data-name]').value.trim();
    const message = form.querySelector('[data-message]').value.trim();
    try {
      form.elements.label.value = (await get('/register', { name, message })).label ?? '';
    } catch {
      form.elements.label.value = '';   // воркер недоступен: платёж анонимный, но проходит
    }
    form.elements.successURL.value = quickpayFields({ sum: n, label: '', lang }).successURL;
    form.submit();
    busy = false;
  });
}

export function mountDonate({ form, stats, fetchJson: get = fetchJson, lang = LANG } = {}) {
  if (form) mountForm(form, get, lang);
  if (stats) mountStats(stats, get, lang);
}

// Страница «Траты»: expenses.json из репозитория, собрано из воркера (null: воркер недоступен).
export function renderExpenses(root, expenses, raisedKop, lang = LANG) {
  const kop = (rub) => Math.round(Number(rub) * 100);
  const spent = expenses.reduce((s, x) => s + kop(x.amount), 0);
  root.querySelector('[data-raised]').textContent = raisedKop == null ? '—' : formatRub(raisedKop, lang);
  root.querySelector('[data-spent]').textContent = formatRub(spent, lang);
  root.querySelector('[data-left]').textContent = raisedKop == null ? '—' : formatRub(raisedKop - spent, lang);
  const date = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'medium', timeZone: 'UTC' });
  const rows = [...expenses].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((x) => {
    const tr = el('tr');
    const receipt = el('td', 'spent__receipt');
    if (/^https?:\/\//i.test(x.url ?? '')) {
      const a = el('a', null, pick(T.receipt, lang));
      Object.assign(a, { href: x.url, target: '_blank', rel: 'noopener' });
      receipt.append(a);
    }
    tr.append(
      el('td', 'tech', date.format(new Date(x.date))),
      el('td', null, pick(x.what, lang)),
      el('td', 'spent__sum tech', formatRub(kop(x.amount), lang)),
      receipt,
    );
    return tr;
  });
  root.querySelector('[data-rows]').replaceChildren(...rows);
  root.querySelector('[data-empty]').hidden = rows.length > 0;
}

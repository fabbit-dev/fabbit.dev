import { verifySign } from './sign.js';
import { bucket } from './s3.js';
import { INDEX, OP_RE, LABEL_RE, donationKey, pendingKey, addToIndex, reconcile } from './store.js';

// Донаты fabbit.dev через ЮMoney. Хранение в S3 cloud.ru (данные в РФ, 152-ФЗ), раскладка в store.js.
//   POST /register  сайт до оплаты: имя и сообщение → label для формы quickpay
//   POST /yoomoney  HTTP-уведомление ЮMoney о переводе
//   GET  /stats     итог и список донатов: топ по сумме или недавние, по страницам
const NAME_MAX = 40;
const MESSAGE_MAX = 200;
const BODY_MAX = 8192;        // уведомление ЮMoney меньше 1 КБ
const PAGE_MAX = 1000;
const PENDING_TTL = 24 * 3600 * 1000;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

// CORS только для сайта; чужой Origin не получает заголовков
function cors(req, env) {
  return req.headers.get('origin') === env.ALLOWED_ORIGIN
    ? { 'access-control-allow-origin': env.ALLOWED_ORIGIN, vary: 'origin' }
    : null;
}

// Строка от посетителя: невидимые символы форматирования (в т. ч. смена направления текста) убраны,
// управляющие и переводы строк в пробел, края обрезаны, пустая → null.
// undefined → null, не строка или длиннее max → ошибка.
function text(v, max) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new TypeError('not a string');
  const s = v.replace(/\p{Cf}/gu, '').replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ').trim();
  if ([...s].length > max) throw new RangeError('too long');
  return s || null;
}

async function register(req, env) {
  const h = cors(req, env);
  if (!h) return json({ error: 'forbidden' }, 403);
  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!(await env.REGISTER_LIMIT.limit({ key: ip })).success) return json({ error: 'slow down' }, 429, h);
  let name, message;
  try {
    const body = await req.json();
    name = text(body?.name, NAME_MAX);
    message = text(body?.message, MESSAGE_MAX);
  } catch {
    return json({ error: 'bad request' }, 400, h);
  }
  const label = crypto.randomUUID();
  await bucket(env).put(pendingKey(label), { name, message, created_at: Date.now() });
  return json({ label }, 200, h);
}

// id анонима: 4 hex-цифры, случайные, с operation_id не связаны
const anonId = () => [...crypto.getRandomValues(new Uint8Array(2))].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

// Уведомление ЮMoney. 200 значит «принято», иначе ЮMoney повторит через 10 минут и через час.
// Повтор с тем же operation_id ничего не меняет. Имя и сообщение берутся из заявки по label,
// заявка после оплаты удаляется: второй платёж по тому же label идёт анонимно.
async function yoomoney(req, env) {
  if (Number(req.headers.get('content-length') ?? 0) > BODY_MAX) return new Response('too large', { status: 413 });
  const body = await req.text();
  if (body.length > BODY_MAX) return new Response('too large', { status: 413 });
  const p = Object.fromEntries(new URLSearchParams(body));
  if (!(await verifySign(p, env.YOOMONEY_SECRET))) {
    // названия полей без значений: видно, чем уведомление отличается от ожидаемого, без персональных данных
    console.warn('yoomoney: bad sign', p.operation_id, Object.keys(p).sort().join(','));
    return new Response('bad sign', { status: 400 });
  }
  // кнопка «Протестировать» в настройках ЮMoney
  if (p.test_notification === 'true' || p.operation_id === 'test-notification') return new Response('test ok');
  // холд и код протекции ЮMoney отменили, валюта всегда рубли; иное не считаем
  if (p.currency !== '643' || p.unaccepted === 'true' || p.codepro === 'true') {
    console.warn('yoomoney: skipped', p.operation_id, p.currency, p.unaccepted, p.codepro);
    return new Response('skipped');
  }
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(p.amount ?? '');
  const op = p.operation_id ?? '';
  if (!m || !OP_RE.test(op) || (p.datetime ?? '').length > 40) return new Response('bad request', { status: 400 });
  const kop = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  const label = LABEL_RE.test(p.label ?? '') ? p.label : null;
  const s3 = bucket(env);
  // запись доната есть: это повтор уведомления, только дописываем индекс, если прошлый раз не успели
  let d = await s3.get(donationKey(op));
  if (!d) {
    const pending = label && (await s3.get(pendingKey(label)));
    d = { operation_id: op, amount_kop: kop, name: pending?.name ?? null, anon: anonId(),
      message: pending?.message ?? null, paid_at: p.datetime ?? '', hidden: 0 };
    await s3.put(donationKey(op), d);
  }
  await addToIndex(s3, [d]);
  if (label) await s3.del(pendingKey(label));
  return new Response('ok');
}

// Итог и одна страница списка:
//   sort=top     по сумме, по 100: суммы одного имени сложены, каждый анонимный донат отдельной строкой
//   sort=recent  все донаты, новые сверху, по 50
// Аноним (нет имени или hidden = 1): name = null, anon = случайный id. У скрытого message = null.
// Страница с сообщениями тяжелее, поэтому меньше: ответ держим около 16 КБ (Cloudflare из России).
const shown = (d) => d.name !== null && !d.hidden;   // имя показываем; иначе строка анонимная, с anon
// порядок как в SQLite: null раньше строки, строки побайтово
const cmp = (a, b) => (a === b ? 0 : a === null ? -1 : b === null ? 1 : a < b ? -1 : 1);
const LISTS = {
  top: { size: 100, list(all) {
    const named = new Map();
    const rows = [];
    for (const d of all) {
      if (shown(d)) named.set(d.name, (named.get(d.name) ?? 0) + d.amount_kop);
      else rows.push({ name: null, anon: d.anon, amount_kop: d.amount_kop });
    }
    for (const [name, amount_kop] of named) rows.push({ name, anon: null, amount_kop });
    return rows.sort((a, b) => b.amount_kop - a.amount_kop || cmp(a.name, b.name) || cmp(a.anon, b.anon));
  } },
  recent: { size: 50, list: (all) => all.map((d, i) => [d, i])
    .sort(([a, i], [b, j]) => cmp(b.paid_at, a.paid_at) || j - i)
    .map(([d]) => ({ name: shown(d) ? d.name : null, anon: shown(d) ? null : d.anon,
      message: d.hidden ? null : d.message, amount_kop: d.amount_kop, at: d.paid_at })) },
};

async function stats(req, env) {
  const h = cors(req, env) ?? {};
  const q = new URL(req.url).searchParams;
  const sort = q.get('sort') ?? 'top';
  const raw = q.get('page') ?? '0';
  const page = /^\d{1,4}$/.test(raw) ? Number(raw) : -1;
  if (!Object.hasOwn(LISTS, sort) || page < 0 || page > PAGE_MAX) return json({ error: 'bad request' }, 400, h);
  const { size, list } = LISTS[sort];
  const all = (await bucket(env).get(INDEX)) ?? [];
  const rows = list(all).slice(page * size, (page + 1) * size + 1);
  return json({
    total_kop: all.reduce((s, d) => s + d.amount_kop, 0),
    count: all.length,
    sort,
    page,
    items: rows.slice(0, size),
    more: rows.length > size,
  }, 200, { vary: 'origin', ...h, 'cache-control': 'public, max-age=30' });
}

// Перенос из D1, временный: работает, пока в wrangler.prod.jsonc есть привязка DB.
// Повтор безопасен: есть объект доната — не трогаем, индекс дописывается без дублей.
async function importD1(db, s3) {
  const { results } = await db.prepare('SELECT * FROM donations ORDER BY paid_at, rowid').all();
  const donations = results.map(({ operation_id, amount_kop, name, anon, message, paid_at, hidden }) =>
    ({ operation_id, amount_kop, name, anon, message, paid_at, hidden: hidden ? 1 : 0 }));
  for (const d of donations) if (!(await s3.get(donationKey(d.operation_id)))) await s3.put(donationKey(d.operation_id), d);
  const added = await addToIndex(s3, donations);
  if (added) console.warn('importD1: перенесено', added);
}

function preflight(req, env) {
  const h = cors(req, env);
  return new Response(null, {
    status: 204,
    headers: h ? { ...h, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } : {},
  });
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    try {
      if (req.method === 'OPTIONS') return preflight(req, env);
      if (req.method === 'POST' && pathname === '/register') return await register(req, env);
      if (req.method === 'POST' && pathname === '/yoomoney') return await yoomoney(req, env);
      if (req.method === 'GET' && pathname === '/stats') return await stats(req, env);
      return new Response('not found', { status: 404 });
    } catch (e) {
      // S3 недоступно: 500, ЮMoney повторит уведомление
      console.error(pathname, e.message);
      return json({ error: 'storage' }, 500, cors(req, env) ?? {});
    }
  },
  // cron из wrangler.jsonc, раз в час: неоплаченные заявки старше суток, сверка индекса
  async scheduled(_, env) {
    const s3 = bucket(env);
    const old = (await s3.list('pending/')).filter((o) => o.modified < Date.now() - PENDING_TTL);
    await Promise.all(old.map((o) => s3.del(o.key)));
    if (env.DB) await importD1(env.DB, s3);
    const added = await reconcile(s3);
    if (added) console.warn('reconcile: в индекс дописано', added);
  },
};

import { verifySign } from './sign.js';

// Донаты fabbit.dev через ЮMoney.
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
  await env.DB.prepare('INSERT INTO pending (label, name, message, created_at) VALUES (?, ?, ?, ?)')
    .bind(label, name, message, Date.now()).run();
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
    console.warn('yoomoney: bad sign', p.operation_id);
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
  if (!m || !op || op.length > 64 || (p.datetime ?? '').length > 40) return new Response('bad request', { status: 400 });
  const kop = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  const label = p.label ?? '';
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO donations (operation_id, amount_kop, name, message, paid_at, anon)
      SELECT ?1, ?2, pending.name, pending.message, ?3, ?5 FROM (SELECT 1) LEFT JOIN pending ON pending.label = ?4`)
      .bind(op, kop, p.datetime ?? '', label, anonId()),
    env.DB.prepare('DELETE FROM pending WHERE label = ?').bind(label),
  ]);
  return new Response('ok');
}

// Итог и одна страница списка:
//   sort=top     по сумме, по 100: суммы одного имени сложены, каждый анонимный донат отдельной строкой
//   sort=recent  все донаты, новые сверху, по 50
// Аноним (нет имени или hidden = 1): name = null, anon = случайный id. У скрытого message = null.
// Страница с сообщениями тяжелее, поэтому меньше: ответ держим около 16 КБ (Cloudflare из России).
const SHOWN = 'name IS NOT NULL AND hidden = 0';   // имя показываем; иначе строка анонимная, с anon
const LISTS = {
  top: { size: 100, sql: `SELECT name, NULL AS anon, SUM(amount_kop) AS amount_kop FROM donations WHERE ${SHOWN} GROUP BY name
    UNION ALL SELECT NULL, anon, amount_kop FROM donations WHERE NOT (${SHOWN})
    ORDER BY amount_kop DESC, name, anon LIMIT ? OFFSET ?` },
  recent: { size: 50, sql: `SELECT CASE WHEN ${SHOWN} THEN name END AS name, CASE WHEN ${SHOWN} THEN NULL ELSE anon END AS anon,
    CASE hidden WHEN 0 THEN message END AS message, amount_kop, paid_at AS at FROM donations
    ORDER BY paid_at DESC, rowid DESC LIMIT ? OFFSET ?` },
};

async function stats(req, env) {
  const h = cors(req, env) ?? {};
  const q = new URL(req.url).searchParams;
  const sort = q.get('sort') ?? 'top';
  const raw = q.get('page') ?? '0';
  const page = /^\d{1,4}$/.test(raw) ? Number(raw) : -1;
  if (!Object.hasOwn(LISTS, sort) || page < 0 || page > PAGE_MAX) return json({ error: 'bad request' }, 400, h);
  const { size, sql } = LISTS[sort];
  const [total, list] = await env.DB.batch([
    env.DB.prepare('SELECT COALESCE(SUM(amount_kop), 0) AS total_kop, COUNT(*) AS count FROM donations'),
    env.DB.prepare(sql).bind(size + 1, page * size),
  ]);
  return json({
    ...total.results[0],
    sort,
    page,
    items: list.results.slice(0, size),
    more: list.results.length > size,
  }, 200, { vary: 'origin', ...h, 'cache-control': 'public, max-age=30' });
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
    if (req.method === 'OPTIONS') return preflight(req, env);
    if (req.method === 'POST' && pathname === '/register') return register(req, env);
    if (req.method === 'POST' && pathname === '/yoomoney') return yoomoney(req, env);
    if (req.method === 'GET' && pathname === '/stats') return stats(req, env);
    return new Response('not found', { status: 404 });
  },
  // cron из wrangler.jsonc: неоплаченные заявки старше суток
  async scheduled(_, env) {
    await env.DB.prepare('DELETE FROM pending WHERE created_at < ?').bind(Date.now() - PENDING_TTL).run();
  },
};

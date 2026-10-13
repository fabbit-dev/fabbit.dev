import { describe, it, expect } from 'vitest';
import { exports, env } from 'cloudflare:workers';
import { createScheduledController, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../src/index.js';
import { signedString } from '../src/sign.js';

const SITE = 'https://fabbit.dev';
const BASE = 'https://donate.fabbit.dev';
let ops = 0;

async function hmac(s, secret = 'test-secret') {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// уведомление в формате ЮMoney; sign считается после подстановки полей
async function notify(fields = {}, { secret } = {}) {
  const p = {
    notification_type: 'card-incoming', operation_id: `op-${++ops}`, amount: '98.00', withdraw_amount: '100.00',
    currency: '643', datetime: `2026-10-13T10:00:${String(ops).padStart(2, '0')}Z`, sender: '', codepro: 'false',
    label: '', unaccepted: 'false', ...fields,
  };
  if (!('sign' in fields)) p.sign = await hmac(signedString(p), secret);
  return exports.default.fetch(`${BASE}/yoomoney`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(p).toString(),
  });
}

const register = async (body) => (await (await exports.default.fetch(`${BASE}/register`, {
  method: 'POST', headers: { origin: SITE, 'cf-connecting-ip': `192.0.2.${ops % 250}` }, body: JSON.stringify(body),
})).json()).label;

const stats = async (q = '') => (await exports.default.fetch(`${BASE}/stats${q}`, { headers: { origin: SITE } })).json();

describe('POST /yoomoney', () => {
  it('оплата по заявке: сумма, имя и сообщение попадают в статистику', async () => {
    const label = await register({ name: 'Петя', message: 'На осциллограф' });
    expect((await notify({ label, amount: '98.00' })).status).toBe(200);
    const s = await stats();
    expect(s.total_kop).toBe(9800);
    expect(s.count).toBe(1);
    expect(s.donors).toEqual([{ name: 'Петя', amount_kop: 9800 }]);
    expect(s.recent).toEqual([{ name: 'Петя', message: 'На осциллограф', amount_kop: 9800, at: '2026-10-13T10:00:01Z' }]);
  });

  it('повтор уведомления с тем же operation_id не удваивает сумму', async () => {
    const label = await register({ name: 'Петя' });
    await notify({ label, operation_id: 'same' });
    expect((await notify({ label, operation_id: 'same' })).status).toBe(200);
    expect((await stats()).total_kop).toBe(9800);
  });

  it('без заявки: в итоге есть, в списке донатеров нет', async () => {
    await notify({ amount: '485.00' });
    const s = await stats();
    expect(s.total_kop).toBe(48500);
    expect(s.donors).toEqual([]);
    expect(s.recent[0]).toMatchObject({ name: null, message: null, amount_kop: 48500 });
  });

  it('заявка без имени: аноним, сообщение остаётся', async () => {
    const label = await register({ message: 'Привет' });
    await notify({ label });
    const s = await stats();
    expect(s.donors).toEqual([]);
    expect(s.recent[0]).toMatchObject({ name: null, message: 'Привет' });
  });

  it('управляющие символы и смена направления текста из имени и сообщения убраны', async () => {
    await notify({ label: await register({ name: '  Ва\u202Eся\n', message: 'a\u0000b' }) });
    expect((await stats()).recent[0]).toMatchObject({ name: 'Вася', message: 'a b' });
  });

  it('второй платёж по тому же label идёт анонимно', async () => {
    const label = await register({ name: 'Петя' });
    await notify({ label, amount: '100.00' });
    await notify({ label, amount: '50.00' });
    const s = await stats();
    expect(s.total_kop).toBe(15000);
    expect(s.donors).toEqual([{ name: 'Петя', amount_kop: 10000 }]);
  });

  it.each([
    ['чужая подпись', { secret: 'wrong' }, {}],
    ['подпись от других полей', {}, { sign: 'a'.repeat(64) }],
    ['без подписи', {}, { sign: '' }],
  ])('%s: 400, в статистике пусто', async (_, opts, fields) => {
    expect((await notify(fields, opts)).status).toBe(400);
    expect((await stats()).total_kop).toBe(0);
  });

  it('тестовое уведомление из настроек ЮMoney: 200, без записи', async () => {
    const res = await notify({ operation_id: 'test-notification', test_notification: 'true' });
    expect(res.status).toBe(200);
    expect((await stats()).count).toBe(0);
  });

  it.each([
    ['не рубли', { currency: '840' }],
    ['перевод с холдированием', { unaccepted: 'true' }],
    ['перевод с кодом протекции', { codepro: 'true' }],
  ])('%s: 200, в итог не идёт', async (_, fields) => {
    expect((await notify(fields)).status).toBe(200);
    expect((await stats()).total_kop).toBe(0);
  });

  it.each([
    ['сумма не число', { amount: '1e3' }],
    ['без operation_id', { operation_id: '' }],
  ])('%s: 400', async (_, fields) => {
    expect((await notify(fields)).status).toBe(400);
  });

  it('тело больше 8 КБ: 413', async () => {
    const res = await exports.default.fetch(`${BASE}/yoomoney`, { method: 'POST', body: 'x='.padEnd(9000, 'x') });
    expect(res.status).toBe(413);
  });
});

describe('GET /stats', () => {
  it('донатеры с одинаковым именем суммируются, порядок по сумме', async () => {
    for (const [name, amount] of [['Аня', '100.00'], ['Боря', '500.00'], ['Аня', '450.50']]) {
      await notify({ label: await register({ name }), amount });
    }
    expect((await stats()).donors).toEqual([
      { name: 'Аня', amount_kop: 55050 },
      { name: 'Боря', amount_kop: 50000 },
    ]);
  });

  it('донатеры по 100 на страницу', async () => {
    await env.DB.batch(Array.from({ length: 150 }, (_, i) => env.DB
      .prepare('INSERT INTO donations (operation_id, amount_kop, name, paid_at) VALUES (?, ?, ?, ?)')
      .bind(`seed-${i}`, 100000 - i, `Донатер ${i}`, '2026-10-01T00:00:00Z')));
    const p0 = await stats();
    expect(p0.donors).toHaveLength(100);
    expect(p0.donors[0].name).toBe('Донатер 0');
    expect(p0.more).toBe(true);
    const p1 = await stats('?page=1');
    expect(p1.donors).toHaveLength(50);
    expect(p1.donors[0].name).toBe('Донатер 100');
    expect(p1.more).toBe(false);
  });

  it('последние 10 донатов, новые сверху', async () => {
    for (let i = 0; i < 12; i++) await notify({ amount: `${i + 1}.00` });
    const { recent } = await stats();
    expect(recent).toHaveLength(10);
    expect(recent[0].amount_kop).toBe(1200);
  });

  it('скрытый донат (hidden = 1): сумма в итоге, имя и сообщение скрыты', async () => {
    await notify({ label: await register({ name: 'Спамер', message: 'реклама' }), operation_id: 'spam' });
    await env.DB.prepare("UPDATE donations SET hidden = 1 WHERE operation_id = 'spam'").run();
    const s = await stats();
    expect(s.total_kop).toBe(9800);
    expect(s.donors).toEqual([]);
    expect(s.recent[0]).toMatchObject({ name: null, message: null });
  });

  it('CORS только для сайта', async () => {
    const own = await exports.default.fetch(`${BASE}/stats`, { headers: { origin: SITE } });
    expect(own.headers.get('access-control-allow-origin')).toBe(SITE);
    const evil = await exports.default.fetch(`${BASE}/stats`, { headers: { origin: 'https://evil.example' } });
    expect(evil.headers.get('access-control-allow-origin')).toBe(null);
  });

  it.each(['-1', 'abc', '100000'])('page=%s: 400', async (p) => {
    expect((await exports.default.fetch(`${BASE}/stats?page=${p}`)).status).toBe(400);
  });
});

describe('ночная чистка', () => {
  it('неоплаченная заявка старше суток удаляется, оплата по ней идёт анонимно', async () => {
    await env.DB.prepare('INSERT INTO pending (label, name, message, created_at) VALUES (?, ?, ?, ?)')
      .bind('old-label', 'Старый', null, Date.now() - 25 * 3600 * 1000).run();
    const fresh = await register({ name: 'Свежий' });
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController(), env, ctx);
    await waitOnExecutionContext(ctx);
    await notify({ label: 'old-label' });
    await notify({ label: fresh });
    expect((await stats()).donors).toEqual([{ name: 'Свежий', amount_kop: 9800 }]);
  });
});

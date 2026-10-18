import { describe, it, expect, vi } from 'vitest';
import { exports, env } from 'cloudflare:workers';
import { createScheduledController, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../src/index.js';
import { bucket } from '../src/s3.js';
import { updateDonation } from '../src/store.js';
import { signedString } from '../src/sign.js';
import { put, get, objects, opts } from './s3mock.js';

const SITE = 'https://fabbit.dev';
const BASE = 'https://donate.fabbit.dev';
let ops = 0;
const ANON = /^[0-9A-F]{4}$/;

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

// донаты сразу в индекс, мимо уведомлений
const seed = (rows) => put('index.json', rows.map((r, i) => ({ operation_id: `seed-${i}`, anon: 'TEST', message: null, hidden: 0, ...r })));

const stats = async (q = '') => (await exports.default.fetch(`${BASE}/stats${q}`, { headers: { origin: SITE } })).json();
const top = async () => (await stats('?sort=top')).items;
const recent = async () => (await stats('?sort=recent')).items;

describe('POST /yoomoney', () => {
  it('оплата по заявке: сумма, имя и сообщение попадают в статистику', async () => {
    const label = await register({ name: 'Петя', message: 'На осциллограф' });
    expect((await notify({ label, amount: '98.00' })).status).toBe(200);
    const s = await stats();
    expect(s.total_kop).toBe(9800);
    expect(s.count).toBe(1);
    expect(await top()).toEqual([{ name: 'Петя', anon: null, amount_kop: 9800 }]);
    expect(await recent()).toEqual([{ name: 'Петя', anon: null, message: 'На осциллограф', amount_kop: 9800, at: '2026-10-13T10:00:01Z' }]);
  });

  it('повтор уведомления с тем же operation_id не удваивает сумму', async () => {
    const label = await register({ name: 'Петя' });
    await notify({ label, operation_id: 'same' });
    expect((await notify({ label, operation_id: 'same' })).status).toBe(200);
    expect((await stats()).total_kop).toBe(9800);
  });

  it('без заявки: аноним со случайным id, в топе отдельной строкой', async () => {
    await notify({ amount: '485.00' });
    expect((await stats()).total_kop).toBe(48500);
    expect(await top()).toEqual([{ name: null, anon: expect.stringMatching(ANON), amount_kop: 48500 }]);
    expect((await recent())[0]).toMatchObject({ name: null, anon: expect.stringMatching(ANON), message: null, amount_kop: 48500 });
  });

  it('заявка без имени: аноним, сообщение остаётся', async () => {
    const label = await register({ message: 'Привет' });
    await notify({ label });
    expect((await top())[0]).toMatchObject({ name: null, anon: expect.stringMatching(ANON) });
    expect((await recent())[0]).toMatchObject({ name: null, message: 'Привет' });
  });

  it('управляющие символы и смена направления текста из имени и сообщения убраны', async () => {
    await notify({ label: await register({ name: '  Ва\u202Eся\n', message: 'a\u0000b' }) });
    expect((await recent())[0]).toMatchObject({ name: 'Вася', message: 'a b' });
  });

  it('у каждого анонимного доната свой id, в топе они не складываются', async () => {
    await notify({ amount: '100.00' });
    await notify({ amount: '200.00' });
    const t = await top();
    expect(t.map((d) => d.amount_kop)).toEqual([20000, 10000]);
    expect(t[0].anon).not.toBe(t[1].anon);
  });

  it('второй платёж по тому же label идёт анонимно', async () => {
    const label = await register({ name: 'Петя' });
    await notify({ label, amount: '100.00' });
    await notify({ label, amount: '50.00' });
    const s = await stats();
    expect(s.total_kop).toBe(15000);
    expect(await top()).toEqual([
      { name: 'Петя', anon: null, amount_kop: 10000 },
      { name: null, anon: expect.stringMatching(ANON), amount_kop: 5000 },
    ]);
  });

  it('чужая подпись: в лог названия полей, без значений', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await notify({ label: 'secret-label', amount: '98.00', operation_id: 'op-log', firstname: 'Иван' }, { secret: 'wrong' });
    const line = warn.mock.calls.map((c) => c.join(' ')).join('\n');
    warn.mockRestore();
    expect(line).toContain('bad sign');
    expect(line).toContain('op-log');
    expect(line).toContain('amount,codepro,currency,datetime,firstname,label,notification_type,operation_id,sender,sign,unaccepted,withdraw_amount');
    expect(line).not.toMatch(/secret-label|98\.00|Иван/);
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
    expect(await top()).toEqual([
      { name: 'Аня', anon: null, amount_kop: 55050 },
      { name: 'Боря', anon: null, amount_kop: 50000 },
    ]);
  });

  it('топ: по 100 на страницу, по умолчанию', async () => {
    seed(Array.from({ length: 150 }, (_, i) => ({ amount_kop: 100000 - i, name: `Донатер ${i}`, paid_at: '2026-10-01T00:00:00Z' })));
    const p0 = await stats();
    expect(p0.sort).toBe('top');
    expect(p0.items).toHaveLength(100);
    expect(p0.items[0].name).toBe('Донатер 0');
    expect(p0.more).toBe(true);
    const p1 = await stats('?sort=top&page=1');
    expect(p1.items).toHaveLength(50);
    expect(p1.items[0].name).toBe('Донатер 100');
    expect(p1.more).toBe(false);
  });

  it('недавние: все донаты, анонимы тоже, новые сверху, по 50 на страницу', async () => {
    seed(Array.from({ length: 60 }, (_, i) => ({ amount_kop: 100 * (i + 1), name: i % 2 ? null : `Д${i}`,
      paid_at: `2026-10-01T00:${String(i).padStart(2, '0')}:00Z` })));
    const p0 = await stats('?sort=recent');
    expect(p0.items).toHaveLength(50);
    expect(p0.items[0]).toMatchObject({ name: null, amount_kop: 6000 });
    expect(p0.items[1]).toMatchObject({ name: 'Д58', amount_kop: 5900 });
    expect(p0.more).toBe(true);
    const p1 = await stats('?sort=recent&page=1');
    expect(p1.items).toHaveLength(10);
    expect(p1.more).toBe(false);
  });

  it('скрытый донат (hidden = 1): сумма в итоге, имя и сообщение скрыты', async () => {
    await notify({ label: await register({ name: 'Спамер', message: 'реклама' }), operation_id: 'spam' });
    await updateDonation(bucket(env), 'spam', { hidden: 1 });
    expect(get('donations/spam.json').hidden).toBe(1);
    expect((await stats()).total_kop).toBe(9800);
    expect(await top()).toEqual([{ name: null, anon: expect.stringMatching(ANON), amount_kop: 9800 }]);
    expect((await recent())[0]).toMatchObject({ name: null, anon: expect.stringMatching(ANON), message: null });
  });

  it('CORS только для сайта', async () => {
    const own = await exports.default.fetch(`${BASE}/stats`, { headers: { origin: SITE } });
    expect(own.headers.get('access-control-allow-origin')).toBe(SITE);
    const evil = await exports.default.fetch(`${BASE}/stats`, { headers: { origin: 'https://evil.example' } });
    expect(evil.headers.get('access-control-allow-origin')).toBe(null);
    // кеш браузера не должен отдать сайту ответ, полученный без Origin
    for (const r of [own, evil]) expect(r.headers.get('vary')).toMatch(/origin/i);
  });

  it.each(['page=-1', 'page=abc', 'page=100000', 'sort=new', 'sort='])('%s: 400', async (q) => {
    expect((await exports.default.fetch(`${BASE}/stats?${q}`)).status).toBe(400);
  });
});

const cron = async () => {
  const ctx = createExecutionContext();
  await worker.scheduled(createScheduledController(), env, ctx);
  await waitOnExecutionContext(ctx);
};

describe('cron', () => {
  it('неоплаченная заявка старше суток удаляется, оплата по ней идёт анонимно', async () => {
    const old = '00000000-0000-4000-8000-000000000000';
    put(`pending/${old}.json`, { name: 'Старый', message: null, created_at: 0 }, Date.now() - 25 * 3600 * 1000);
    const fresh = await register({ name: 'Свежий' });
    await cron();
    expect(get(`pending/${old}.json`)).toBe(null);
    await notify({ label: old });
    await notify({ label: fresh });
    const t = await top();
    expect(t.map((d) => d.name).sort()).toEqual([null, 'Свежий'].sort());   // старая заявка удалена: платёж анонимный
  });

  it('донат, потерянный индексом, возвращается сверкой, по всем страницам списка', async () => {
    opts.pageSize = 2;
    for (let i = 0; i < 5; i++) await notify({ operation_id: `r${i}` });
    put('index.json', get('index.json').filter((d) => d.operation_id !== 'r3'));
    expect((await stats()).count).toBe(4);
    await cron();
    expect((await stats()).count).toBe(5);
  });
});

describe('хранение в S3', () => {
  it('нет бакета (опечатка в S3_BUCKET): 500, не пустой список', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    env.S3_BUCKET = 'typo';
    try {
      expect((await exports.default.fetch(`${BASE}/stats`)).status).toBe(500);
    } finally {
      env.S3_BUCKET = 'bucket';
      err.mockRestore();
    }
  });

  it('cron переносит донаты из D1, повтор без дублей', async () => {
    const row = { operation_id: '845', amount_kop: 9700, name: 'Друг', anon: 'AB12', message: 'привет', paid_at: '2026-10-17T15:28:32Z', hidden: 0 };
    const DB = { prepare: () => ({ all: async () => ({ results: [row] }) }) };
    for (let i = 0; i < 2; i++) {
      const ctx = createExecutionContext();
      await worker.scheduled(createScheduledController(), { ...env, DB }, ctx);
      await waitOnExecutionContext(ctx);
    }
    expect(get('donations/845.json')).toEqual(row);
    expect(await top()).toEqual([{ name: 'Друг', anon: null, amount_kop: 9700 }]);
    expect((await stats()).count).toBe(1);
  });

  it('донат: отдельный объект donations/<operation_id>.json и строка индекса, заявка удалена', async () => {
    const label = await register({ name: 'Петя', message: 'Удачи' });
    expect(get(`pending/${label}.json`)).toMatchObject({ name: 'Петя', message: 'Удачи' });
    await notify({ label, operation_id: '123456789', amount: '98.00' });
    const d = get('donations/123456789.json');
    expect(d).toEqual({ operation_id: '123456789', amount_kop: 9800, name: 'Петя', anon: expect.stringMatching(ANON),
      message: 'Удачи', paid_at: expect.any(String), hidden: 0 });
    expect(get('index.json')).toEqual([d]);
    expect(get(`pending/${label}.json`)).toBe(null);
  });

  it('индекс не записался: повтор уведомления дописывает его, донат тот же', async () => {
    await notify({ operation_id: 'lost' });
    const d = get('donations/lost.json');
    objects.delete('index.json');
    expect((await notify({ operation_id: 'lost' })).status).toBe(200);
    expect(get('index.json')).toEqual([d]);
  });

  it('S3 отвечает ошибкой: 500, ЮMoney повторит', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    env.S3_KEY_ID = 'other:key';
    try {
      expect((await notify()).status).toBe(500);
      expect((await exports.default.fetch(`${BASE}/stats`)).status).toBe(500);
      expect(err).toHaveBeenCalledWith('/yoomoney', expect.stringContaining('403'));
    } finally {
      env.S3_KEY_ID = 'tenant:key';
      err.mockRestore();
    }
  });

  it('operation_id с символами вне [A-Za-z0-9_.-]: 400, ключ не строится', async () => {
    expect((await notify({ operation_id: '../index' })).status).toBe(400);
    expect(objects.size).toBe(0);
  });

  it('модерация: удалённый донат пропадает из объекта и индекса', async () => {
    await notify({ operation_id: 'manual-1' });
    await updateDonation(bucket(env), 'manual-1', null);
    expect(get('donations/manual-1.json')).toBe(null);
    expect((await stats()).count).toBe(0);
  });
});

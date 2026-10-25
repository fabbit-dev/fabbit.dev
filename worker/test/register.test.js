import { describe, it, expect } from 'vitest';
import { exports } from 'cloudflare:workers';

const SITE = 'https://fabbit.dev';
let ip = 0;
const register = (body, origin = SITE) => exports.default.fetch('https://donate.fabbit.dev/register', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin, 'cf-connecting-ip': `203.0.113.${++ip}` },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('POST /register', () => {
  it('выдаёт label для формы ЮMoney', async () => {
    const res = await register({ name: 'Петя', message: 'Удачи!' });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(SITE);
    const { label } = await res.json();
    expect(label).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('каждый раз новый label', async () => {
    const a = await (await register({})).json();
    const b = await (await register({})).json();
    expect(a.label).not.toBe(b.label);
  });

  it('чужой сайт получает 403', async () => {
    const res = await register({ name: 'x' }, 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBe(null);
  });

  it.each([
    ['имя длиннее 40 символов', { name: 'я'.repeat(41) }],
    ['сообщение длиннее 200 символов', { message: 'я'.repeat(201) }],
    ['имя не строка', { name: 42 }],
    ['битый JSON', '{'],
    ['null', 'null'],
    ['массив', '[]'],
    ['число', '42'],
  ])('%s: 400', async (_, body) => {
    expect((await register(body)).status).toBe(400);
  });

  it('тело больше 8 КБ без Content-Length: 413', async () => {
    const res = await register({ extra: 'я'.repeat(5000) });
    expect(res.status).toBe(413);
    expect(res.headers.get('access-control-allow-origin')).toBe(SITE);
  });

  it('предзапрос CORS разрешён только сайту', async () => {
    const pre = (origin) => exports.default.fetch('https://donate.fabbit.dev/register', {
      method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' },
    });
    const ok = await pre(SITE);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe(SITE);
    expect(ok.headers.get('access-control-allow-headers')).toMatch(/content-type/i);
    expect((await pre('https://evil.example')).headers.get('access-control-allow-origin')).toBe(null);
  });
});

describe('POST /register: лимит', () => {
  it('с одного IP не больше 10 заявок в минуту', async () => {
    const send = () => exports.default.fetch('https://donate.fabbit.dev/register', {
      method: 'POST', headers: { origin: SITE, 'cf-connecting-ip': '198.51.100.7' }, body: '{}',
    });
    const codes = [];
    for (let i = 0; i < 11; i++) codes.push((await send()).status);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes[10]).toBe(429);
  });
});

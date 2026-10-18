// Клиент S3 для Object Storage cloud.ru: подпись AWS Signature V4, адреса path-style
// <S3_ENDPOINT>/<S3_BUCKET>/<key>. Работает и в воркере, и в Node (scripts/s3.mjs).
// Условной записи (If-None-Match) в cloud.ru нет: идемпотентность держим сами, в store.js.
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hmac(key, s) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(s));
}
// RFC 3986, как требует SigV4
const uri = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// Заголовки запроса с подписью. url: URL, путь уже закодирован; body: строка.
export async function sign({ method, url, headers = {}, body = '', keyId, secret, region, service = 's3', date = new Date() }) {
  const amzDate = date.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const h = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])),
    host: url.host, 'x-amz-date': amzDate, 'x-amz-content-sha256': await sha256(body) };
  const names = Object.keys(h).sort();
  const query = [...url.searchParams].map(([k, v]) => [uri(k), uri(v)]).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`).join('&');
  const canonical = [method, url.pathname, query, ...names.map((n) => `${n}:${h[n]}`), '', names.join(';'), h['x-amz-content-sha256']].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonical)].join('\n');
  let key = `AWS4${secret}`;
  for (const part of [day, region, service, 'aws4_request']) key = await hmac(key, part);
  delete h.host;
  h.authorization = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${hex(await hmac(key, toSign))}`;
  return h;
}

const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Бакет из env: S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_KEY_ID (<tenant_id>:<key_id>), S3_SECRET.
// Объекты храним JSON. Ключи из латиницы, цифр и «/._-», кодировать нечего.
export function bucket(env) {
  const base = `${env.S3_ENDPOINT.replace(/\/$/, '')}/${env.S3_BUCKET}`;
  async function req(method, key, { body = '', query = {}, headers = {} } = {}) {
    const url = new URL(`${base}/${key}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const signed = await sign({ method, url, headers, body, keyId: env.S3_KEY_ID, secret: env.S3_SECRET, region: env.S3_REGION });
    const res = await fetch(url, { method, headers: signed, body: method === 'PUT' ? body : undefined });
    if (!res.ok && res.status !== 404) throw new Error(`s3 ${method} ${key}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res;
  }
  return {
    // объект или null, если его нет
    async get(key) {
      const res = await req('GET', key);
      return res.status === 404 ? (await res.body?.cancel(), null) : res.json();
    },
    async put(key, data) {
      await (await req('PUT', key, { body: JSON.stringify(data), headers: { 'content-type': 'application/json' } })).body?.cancel();
    },
    async del(key) {
      await (await req('DELETE', key)).body?.cancel();
    },
    // все ключи с префиксом: [{ key, modified: мс }]. ListObjects v1 с marker: continuation-token в документации cloud.ru нет
    async list(prefix) {
      const out = [];
      for (let marker = ''; ;) {
        const xml = await (await req('GET', '', { query: { prefix, ...(marker && { marker }) } })).text();
        for (const [, c] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          out.push({ key: unxml(/<Key>([\s\S]*?)<\/Key>/.exec(c)[1]), modified: Date.parse(/<LastModified>(.*?)<\/LastModified>/.exec(c)?.[1]) });
        }
        if (!/<IsTruncated>true<\/IsTruncated>/.test(xml) || !out.length) return out;
        marker = out.at(-1).key;
      }
    },
  };
}

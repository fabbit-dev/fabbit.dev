// S3 в памяти вместо cloud.ru: GET, PUT, DELETE, ListObjects v1 с marker.
// Запрос без подписи для региона ru-central-1 и ключа tenant:key получает 403.
export const objects = new Map();   // key → { body, modified }
export const opts = { pageSize: 1000 };

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function s3fetch(input, init = {}) {
  const url = new URL(input);
  if (url.origin !== 'https://s3.test') throw new Error(`чужой адрес в тесте: ${url}`);
  const auth = new Headers(init.headers).get('authorization') ?? '';
  if (!/^AWS4-HMAC-SHA256 Credential=tenant:key\/\d{8}\/ru-central-1\/s3\/aws4_request, SignedHeaders=\S+, Signature=[0-9a-f]{64}$/.test(auth)) {
    return new Response('AccessDenied', { status: 403 });
  }
  const [, bucket, ...rest] = url.pathname.split('/');
  if (bucket !== 'bucket') return new Response('<Error><Code>NoSuchBucket</Code></Error>', { status: 404 });
  const key = decodeURIComponent(rest.join('/'));
  const method = init.method ?? 'GET';
  if (method === 'GET' && !key) {
    const prefix = url.searchParams.get('prefix') ?? '';
    const marker = url.searchParams.get('marker') ?? '';
    const keys = [...objects.keys()].filter((k) => k.startsWith(prefix) && k > marker).sort();
    const page = keys.slice(0, opts.pageSize);
    return new Response(`<?xml version="1.0"?><ListBucketResult><IsTruncated>${keys.length > page.length}</IsTruncated>${page
      .map((k) => `<Contents><Key>${xml(k)}</Key><LastModified>${new Date(objects.get(k).modified).toISOString()}</LastModified></Contents>`).join('')}</ListBucketResult>`);
  }
  if (method === 'GET') {
    const o = objects.get(key);
    return o ? new Response(o.body) : new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
  }
  if (method === 'PUT') {
    objects.set(key, { body: init.body, modified: Date.now() });
    return new Response('');
  }
  if (method === 'DELETE') {
    objects.delete(key);
    return new Response(null, { status: 204 });
  }
  return new Response('NotImplemented', { status: 501 });
}

// объект напрямую, мимо воркера
export const put = (key, data, modified = Date.now()) => objects.set(key, { body: JSON.stringify(data), modified });
export const get = (key) => (objects.has(key) ? JSON.parse(objects.get(key).body) : null);

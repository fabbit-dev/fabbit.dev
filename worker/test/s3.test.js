import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { bucket, sign } from '../src/s3.js';

describe('подпись SigV4', () => {
  // пример GET Object из документации AWS «Signature Calculations for the Authorization Header»
  it('совпадает с примером AWS', async () => {
    const h = await sign({
      method: 'GET', url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'), headers: { Range: 'bytes=0-9' },
      keyId: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1',
      date: new Date('2013-05-24T00:00:00Z'),
    });
    expect(h.authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, '
      + 'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  });

  it('пример AWS с параметрами запроса (GET Bucket lifecycle)', async () => {
    const h = await sign({
      method: 'GET', url: new URL('https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J'),
      keyId: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1',
      date: new Date('2013-05-24T00:00:00Z'),
    });
    expect(h.authorization).toMatch(/Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7$/);
  });

  it('одинаковые ключи query сортируются также по закодированным значениям', async () => {
    const args = { method: 'GET', keyId: 'key', secret: 'secret', region: 'ru-central-1', date: new Date('2026-10-01T00:00:00Z') };
    const a = await sign({ ...args, url: new URL('https://s3.test/bucket/?x=z&x=a') });
    const b = await sign({ ...args, url: new URL('https://s3.test/bucket/?x=a&x=z') });
    expect(a.authorization).toBe(b.authorization);
  });
});

describe('клиент S3', () => {
  it('ошибки конфигурации видны до сетевого запроса, без значений секретов', () => {
    for (const key of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_REGION', 'S3_KEY_ID', 'S3_SECRET']) {
      expect(() => bucket({ ...env, [key]: '' })).toThrow(key);
    }
  });

  it('сетевой запрос ограничен таймаутом', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    try {
      await bucket(env).get('missing.json');
      expect(spy.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    } finally { spy.mockRestore(); }
  });

  it.each(['http://s3.test', 'https://user:secret@s3.test', 'https://s3.test?token=secret', 'https://s3.test#fragment'])(
    'небезопасный endpoint отклоняется без вывода значения', (endpoint) => {
      expect(() => bucket({ ...env, S3_ENDPOINT: endpoint })).toThrow('s3: invalid S3_ENDPOINT');
    },
  );

  it('повтор страницы ListObjects не зацикливает сверку', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    try {
      // Страховка теста от бесконечного цикла старого клиента.
      let calls = 0;
      spy.mockImplementation(async () => {
        if (++calls > 3) throw new Error('test: runaway pagination');
        return new Response('<ListBucketResult><IsTruncated>true</IsTruncated><Contents><Key>donations/a.json</Key></Contents></ListBucketResult>');
      });
      await expect(bucket(env).list('donations/')).rejects.toThrow('pagination');
      expect(spy).toHaveBeenCalledTimes(2);
    } finally { spy.mockRestore(); }
  });
});

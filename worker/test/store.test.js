import { describe, it, expect, vi } from 'vitest';
import { bucket } from '../src/s3.js';
import { reconcile, updateDonation } from '../src/store.js';
import { env } from 'cloudflare:workers';
import { put, get, objects } from './s3mock.js';

const donation = (op, patch = {}) => ({ operation_id: op, amount_kop: 10000, name: 'Имя', anon: 'ABCD',
  message: 'Сообщение', hidden: 0, paid_at: '2026-10-01T00:00:00Z', ...patch });

describe('индекс как восстанавливаемая копия donations/', () => {
  it('сверка исправляет устаревшую модерацию и убирает удалённые записи', async () => {
    const stale = donation('hidden'), removed = donation('removed');
    put('index.json', [stale, removed]);
    put('donations/hidden.json', { ...stale, hidden: 1 });
    expect(await reconcile(bucket(env))).toBe(0);
    expect(get('index.json')).toEqual([{ ...stale, hidden: 1 }]);
  });

  it('сверка сохраняет порядок индекса, новые записи добавляет по paid_at', async () => {
    const a = donation('a'), b = donation('b'), c = donation('c', { paid_at: '2026-09-01T00:00:00Z' });
    for (const d of [a, b, c]) put(`donations/${d.operation_id}.json`, d);
    put('index.json', [a]);
    expect(await reconcile(bucket(env))).toBe(2);
    expect(get('index.json')).toEqual([a, c, b]);
    expect(await reconcile(bucket(env))).toBe(0);
  });

  it('модерация доната, потерянного индексом, добавляет исправленную запись', async () => {
    const d = donation('lost');
    put('donations/lost.json', d);
    await updateDonation(bucket(env), 'lost', { hidden: 1 });
    expect(get('index.json')).toEqual([{ ...d, hidden: 1 }]);
  });

  it('платёж после ListObjects не теряется при сверке', async () => {
    const d = donation('concurrent');
    const s3 = bucket(env);
    vi.spyOn(s3, 'list').mockImplementationOnce(async () => {
      put('donations/concurrent.json', d);
      put('index.json', [d]);
      return [];
    });
    await reconcile(s3);
    expect(get('index.json')).toEqual([d]);
  });

  it('сбой записи индекса после удаления не воскрешает донат при сверке', async () => {
    const d = donation('deleted');
    put('donations/deleted.json', d);
    put('index.json', [d]);
    const s3 = bucket(env);
    const putSpy = vi.spyOn(s3, 'put').mockRejectedValueOnce(new Error('offline'));
    await expect(updateDonation(s3, 'deleted', null)).rejects.toThrow('offline');
    putSpy.mockRestore();
    expect(objects.has('donations/deleted.json')).toBe(false);
    await reconcile(s3);
    expect(get('index.json')).toEqual([]);
  });
});

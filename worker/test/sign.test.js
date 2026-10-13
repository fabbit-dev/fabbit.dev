import { describe, it, expect } from 'vitest';
import { verifySign } from '../src/sign.js';

// пример из документации ЮMoney: https://yoomoney.ru/docs/payment-buttons/using-api/notifications
const DOC = {
  notification_type: 'p2p-incoming', operation_id: '441361714955017004', amount: '98.00',
  withdraw_amount: '100.00', currency: '643', datetime: '2013-12-26T08:28:34Z', sender: '41000000000',
  codepro: 'false', label: 'ML23045', unaccepted: 'false', sha1_hash: 'ac13833bd6ba9eff1fa9e4bed76f3d6ebb57f6c0',
  sign: 'a452af731650e2c5b39abcdc7c28dd27db7b3b654c2230ad2c386e64afb98605',
};

describe('подпись уведомления', () => {
  it('пример из документации проходит', async () => {
    expect(await verifySign(DOC, 'secret123')).toBe(true);
  });

  it('чужой секрет не проходит', async () => {
    expect(await verifySign(DOC, 'secret124')).toBe(false);
  });

  it('изменённая сумма не проходит', async () => {
    expect(await verifySign({ ...DOC, amount: '9800.00' }, 'secret123')).toBe(false);
  });

  it('без подписи не проходит', async () => {
    const { sign, ...rest } = DOC;
    expect(await verifySign(rest, 'secret123')).toBe(false);
  });

  it('пустой секрет не проходит, даже с подписью от пустого ключа', async () => {
    expect(await verifySign(DOC, '')).toBe(false);
  });
});

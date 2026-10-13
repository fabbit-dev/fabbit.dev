// Подписанное уведомление ЮMoney на воркер: проверка приёма без реального платежа.
//   SECRET=... node scripts/notify.mjs http://localhost:8787 [сумма] [label]
// Сумма попадёт в статистику; в проде удалите строку потом (README, «Модерация»).
import { createHmac } from 'node:crypto';
import { signedString } from '../src/sign.js';

const [base = 'http://localhost:8787', amount = '100.00', label = ''] = process.argv.slice(2);
if (!process.env.SECRET) throw new Error('нужен SECRET: секрет из настроек HTTP-уведомлений');
const p = {
  notification_type: 'card-incoming', operation_id: `manual-${Date.now()}`, amount, withdraw_amount: amount,
  currency: '643', datetime: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), sender: '', codepro: 'false',
  label, unaccepted: 'false',
};
p.sign = createHmac('sha256', process.env.SECRET).update(signedString(p)).digest('hex');
const res = await fetch(`${base}/yoomoney`, { method: 'POST', body: new URLSearchParams(p) });
console.log(res.status, await res.text(), p.operation_id);

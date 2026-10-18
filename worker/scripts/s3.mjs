// Бакет донатов вручную: перенос из D1, модерация, сверка индекса.
// Ключи в worker/.env.s3.local (в .gitignore):
//   S3_KEY_ID=<tenant_id>:<key_id>   S3_SECRET=...   S3_BUCKET=...
// Запуск из worker/:
//   node --env-file=.env.s3.local scripts/s3.mjs list
//   node --env-file=.env.s3.local scripts/s3.mjs hide <operation_id>     скрыть имя и сообщение
//   node --env-file=.env.s3.local scripts/s3.mjs show <operation_id>     вернуть
//   node --env-file=.env.s3.local scripts/s3.mjs delete <operation_id>   удалить (тест-строка notify.mjs)
//   node --env-file=.env.s3.local scripts/s3.mjs reconcile               дописать в индекс потерянные донаты
//   node --env-file=.env.s3.local scripts/s3.mjs import d1.json          перенос из D1, выгрузка:
//     npx wrangler d1 execute fabbit-donate --remote -c wrangler.prod.jsonc --json \
//       --command "SELECT * FROM donations ORDER BY paid_at, rowid" > d1.json
import { readFileSync } from 'node:fs';
import { bucket } from '../src/s3.js';
import { INDEX, OP_RE, donationKey, addToIndex, reconcile, updateDonation } from '../src/store.js';

const env = { S3_ENDPOINT: 'https://s3.cloud.ru', S3_REGION: 'ru-central-1', ...process.env };
for (const k of ['S3_KEY_ID', 'S3_SECRET', 'S3_BUCKET']) if (!env[k]) throw new Error(`нужен ${k}, см. начало файла`);
const s3 = bucket(env);
const [cmd, arg] = process.argv.slice(2);
const op = () => {
  if (!OP_RE.test(arg ?? '')) throw new Error('нужен operation_id');
  return arg;
};

switch (cmd) {
  case 'list':
    for (const d of (await s3.get(INDEX)) ?? []) {
      console.log(d.paid_at, d.operation_id, (d.amount_kop / 100).toFixed(2), d.hidden ? '[скрыт]' : '', d.name ?? `Аноним #${d.anon}`, d.message ?? '');
    }
    break;
  case 'hide':
  case 'show':
    console.log(await updateDonation(s3, op(), { hidden: cmd === 'hide' ? 1 : 0 }));
    break;
  case 'delete':
    await updateDonation(s3, op(), null);
    console.log('удалён', arg);
    break;
  case 'reconcile':
    console.log('дописано в индекс:', await reconcile(s3));
    break;
  case 'import': {
    // wrangler --json: [{ results: [...] }]
    const raw = JSON.parse(readFileSync(arg, 'utf8'));
    const rows = Array.isArray(raw) && raw[0]?.results ? raw.flatMap((r) => r.results) : raw;
    const donations = rows.map((r) => ({
      operation_id: r.operation_id, amount_kop: r.amount_kop, name: r.name, anon: r.anon,
      message: r.message, paid_at: r.paid_at, hidden: r.hidden ? 1 : 0,
    }));
    for (const d of donations) {
      if (!OP_RE.test(d.operation_id)) throw new Error(`operation_id не годится для ключа: ${d.operation_id}`);
      if (!(await s3.get(donationKey(d.operation_id)))) await s3.put(donationKey(d.operation_id), d);
    }
    console.log(`донатов в выгрузке ${donations.length}, дописано в индекс ${await addToIndex(s3, donations)}`);
    break;
  }
  default:
    console.log('команды: list, hide, show, delete, reconcile, import; подробно в начале scripts/s3.mjs');
}

// Раскладка донатов в бакете S3:
//   pending/<label>.json        заявка до оплаты: { name, message, created_at }
//   donations/<operation>.json  оплаченный донат, главная запись: { operation_id, amount_kop, name, anon, message, paid_at, hidden }
//   index.json                  все донаты одним массивом в порядке приёма, из него считается /stats
// Индекс обновляется чтением и записью целиком. Два уведомления в одну секунду могут потерять
// строку индекса; reconcile (cron раз в час) дописывает из donations/ всё, чего в индексе нет.
export const INDEX = 'index.json';
export const donationKey = (op) => `donations/${op}.json`;
export const pendingKey = (label) => `pending/${label}.json`;
export const OP_RE = /^[\w.-]{1,64}$/;
export const LABEL_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// донаты, которых ещё нет в индексе, дописываются в конец; возвращает, сколько дописано
export async function addToIndex(s3, donations) {
  const index = (await s3.get(INDEX)) ?? [];
  const have = new Set(index.map((d) => d.operation_id));
  const add = donations.filter((d) => !have.has(d.operation_id) && have.add(d.operation_id));
  if (add.length) await s3.put(INDEX, [...index, ...add]);
  return add.length;
}

// индекс сверяется с donations/: недостающие донаты дочитываются, по paid_at
export async function reconcile(s3) {
  const index = (await s3.get(INDEX)) ?? [];
  const have = new Set(index.map((d) => donationKey(d.operation_id)));
  const missing = (await s3.list('donations/')).filter((o) => !have.has(o.key));
  if (!missing.length) return 0;
  const found = (await Promise.all(missing.map((o) => s3.get(o.key)))).filter(Boolean);
  return addToIndex(s3, found.sort((a, b) => (a.paid_at < b.paid_at ? -1 : a.paid_at > b.paid_at ? 1 : 0)));
}

// правка доната (модерация): запись и строка индекса вместе. null: удалить донат
export async function updateDonation(s3, op, patch) {
  const d = await s3.get(donationKey(op));
  if (!d) throw new Error(`нет доната ${op}`);
  const index = (await s3.get(INDEX)) ?? [];
  if (patch === null) {
    await s3.put(INDEX, index.filter((x) => x.operation_id !== op));
    await s3.del(donationKey(op));
    return null;
  }
  const next = { ...d, ...patch };
  await s3.put(donationKey(op), next);
  await s3.put(INDEX, index.map((x) => (x.operation_id === op ? next : x)));
  return next;
}

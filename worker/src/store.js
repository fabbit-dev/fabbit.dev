// Раскладка донатов в бакете S3:
//   pending/<label>.json        заявка до оплаты: { name, message, created_at }
//   donations/<operation>.json  оплаченный донат, главная запись: { operation_id, amount_kop, name, anon, message, paid_at, hidden }
//   index.json                  все донаты одним массивом в порядке приёма, из него считается /stats
// Индекс обновляется чтением и записью целиком. Два уведомления в одну секунду могут потерять
// строку индекса; reconcile (cron раз в час) восстанавливает его из главных записей donations/.
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

// donations/ — источник истины: сверка чинит и пропуски, и сбой модерации/удаления.
// Порядок принятых записей сохраняется; новые добавляются по paid_at. Чтение пачками,
// чтобы размер бакета не превращался в столько же одновременных запросов S3.
export async function reconcile(s3) {
  const objects = await s3.list('donations/');
  const found = new Map();
  for (let i = 0; i < objects.length; i += 20) {
    const rows = await Promise.all(objects.slice(i, i + 20).map((o) => s3.get(o.key)));
    for (const d of rows) if (d) found.set(d.operation_id, d);
  }
  const index = (await s3.get(INDEX)) ?? [];
  // Платёж мог прийти после ListObjects: отсутствие в его снимке ещё не означает удаление.
  const unlisted = index.filter((d) => !found.has(d.operation_id));
  for (let i = 0; i < unlisted.length; i += 20) {
    const rows = await Promise.all(unlisted.slice(i, i + 20).map((d) => s3.get(donationKey(d.operation_id))));
    for (const d of rows) if (d) found.set(d.operation_id, d);
  }
  const next = [];
  for (const d of index) {
    if (found.has(d.operation_id)) {
      next.push(found.get(d.operation_id));
      found.delete(d.operation_id);
    }
  }
  const added = found.size;
  next.push(...[...found.values()].sort((a, b) => (a.paid_at < b.paid_at ? -1 : a.paid_at > b.paid_at ? 1 : 0)));
  if (JSON.stringify(next) !== JSON.stringify(index)) await s3.put(INDEX, next);
  return added;
}

// правка доната (модерация): запись и строка индекса вместе. null: удалить донат
export async function updateDonation(s3, op, patch) {
  const d = await s3.get(donationKey(op));
  if (!d) throw new Error(`нет доната ${op}`);
  const index = (await s3.get(INDEX)) ?? [];
  if (patch === null) {
    await s3.del(donationKey(op));
    await s3.put(INDEX, index.filter((x) => x.operation_id !== op));
    return null;
  }
  const next = { ...d, ...patch };
  await s3.put(donationKey(op), next);
  const rows = index.map((x) => (x.operation_id === op ? next : x));
  if (!rows.some((x) => x.operation_id === op)) rows.push(next);
  await s3.put(INDEX, rows);
  return next;
}

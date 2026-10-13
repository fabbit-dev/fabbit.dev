# fabbit.dev

Сайт проекта [Fabbit](https://fabbit.dev).

```bash
npm install
npm run dev
npm run build
```

## Донаты

Посетитель платит через форму ЮMoney (quickpay) на кошелёк `4100119646671169`. Воркер
Cloudflare `worker/` на `donate.fabbit.dev` хранит имена и суммы в D1.

1. Сайт отправляет `POST /register` с именем и сообщением и получает `label`.
2. Форма уходит на `yoomoney.ru/quickpay/confirm` с суммой и `label`. Имя и сообщение
   остаются у воркера, в ЮMoney их не передаём.
3. ЮMoney шлёт `POST /yoomoney`. Воркер проверяет подпись `sign` (HMAC-SHA256) и
   записывает донат один раз на `operation_id`.
4. Блок «Поддержать» и страница `/spent/` читают `GET /stats`: итог и список.
   `?sort=top` сортирует по сумме, по 100 на страницу, суммы одного имени складываются.
   `?sort=recent` выводит все донаты, новые сверху, по 50. Донат без имени показан
   как «Аноним #A3F9»: у каждого свой случайный id, в топе каждый идёт отдельной строкой.

Без JS форма уходит в ЮMoney сама, донат анонимный. Если воркер недоступен (Cloudflare
из России открывается не у всех), оплата тоже проходит, анонимно.

В итог идёт `amount`: сумма, которая дошла до кошелька после комиссии. Сумма в форме от 100
до 15 000 ₽, верхняя граница: лимит ЮMoney на один перевод. Карту или кошелёк посетитель
выбирает на странице ЮMoney.

### Деплой воркера

Зона `fabbit.dev` должна быть в Cloudflare: поддомен `donate` воркер создаёт сам
(`custom_domain` в `worker/wrangler.jsonc`). Записи GitHub Pages не меняются.

```bash
cd worker
npm install --legacy-peer-deps
npm test
npx wrangler login
npx wrangler d1 create fabbit-donate
```

`d1 create` выдаёт `database_id`: впишите его в `worker/wrangler.jsonc` вместо нулей.
Это не секрет, его можно коммитить.

```bash
npx wrangler d1 migrations apply fabbit-donate --remote
npx wrangler secret put YOOMONEY_SECRET
npx wrangler deploy
```

Секрет берите в ЮMoney (следующий раздел). В репозиторий и `wrangler.jsonc` его не пишите.
Логи: `npx wrangler tail`.

### Уведомления в ЮMoney

1. Откройте [настройки HTTP-уведомлений](https://yoomoney.ru/transfer/myservices/http-notification).
2. Адрес: `https://donate.fabbit.dev/yoomoney`.
3. Поставьте галочку «Отправлять HTTP-уведомления», нажмите «Готово».
4. «Показать секрет»: этот секрет введите в `wrangler secret put YOOMONEY_SECRET`.
   Сменили секрет в ЮMoney: повторите `secret put`.

ЮMoney засчитывает только ответ `200` и повторяет уведомление через 10 минут и через час.

### Тестовое уведомление

Кнопка «Протестировать» в настройках шлёт тестовое уведомление. Воркер отвечает `200`
и ничего не записывает. Держите открытым `npx wrangler tail`: в нём видно, что запрос дошёл.
Если в логе `bad sign`, ЮMoney прислал тест без подписи: адрес рабочий, проверьте приём скриптом ниже.

Подписанное уведомление со своей суммой:

```bash
cd worker
SECRET=<секрет> node scripts/notify.mjs https://donate.fabbit.dev 100.00
```

Скрипт печатает `operation_id`. Сумма попадает в итог, поэтому после проверки удалите строку:

```bash
npx wrangler d1 execute fabbit-donate --remote --command "DELETE FROM donations WHERE operation_id = 'manual-…'"
```

Последняя проверка: настоящий платёж на 100 ₽ с сайта. Уведомление ЮMoney приходит из России.
Если в `wrangler tail` его нет, адреса Cloudflare режет провайдер ЮMoney. Тогда
`/yoomoney` придётся перенести на хостинг в России.

### Модерация

Спрятать имя и сообщение доната. Сумма остаётся в итоге, донат показан анонимом:

```bash
npx wrangler d1 execute fabbit-donate --remote --command "UPDATE donations SET hidden = 1 WHERE operation_id = '…'"
```

Последние донаты с `operation_id`:

```bash
npx wrangler d1 execute fabbit-donate --remote --command "SELECT operation_id, name, message, amount_kop FROM donations ORDER BY paid_at DESC LIMIT 20"
```

### Локально

```bash
cd worker
printf 'YOOMONEY_SECRET=dev-secret\nALLOWED_ORIGIN=http://localhost:5190\n' > .dev.vars
npx wrangler d1 migrations apply fabbit-donate --local
npx wrangler dev --port 8787
```

В корне `.env.development.local` с `VITE_DONATE_API=http://localhost:8787`, затем `npm run dev`.
Донат для проверки: `SECRET=dev-secret node scripts/notify.mjs`.

## Траты

Расходы лежат в `public/expenses.json`. Новая трата: строка в массив, затем PR.

```json
[
  {
    "date": "2026-10-01",
    "what": { "ru": "АЦП AD9288, 2 шт.", "en": "AD9288 ADC, 2 pcs" },
    "amount": 1234.50,
    "url": "https://…/чек.pdf"
  }
]
```

- `date`: дата покупки, `ГГГГ-ММ-ДД`.
- `amount`: рубли, копейки через точку.
- `url`: ссылка на чек или заказ, только `https://`. Нет чека: `""`.

Страница `/spent/` складывает траты и вычитает их из собранного.

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

Что нужно заранее:

- Зона `fabbit.dev` в Cloudflare (DNS у неё уже на `*.ns.cloudflare.com`). Поддомен `donate`
  воркер создаёт сам при `deploy` (`custom_domain` в `worker/wrangler.jsonc`) и выпускает
  на него сертификат. Записи `donate` в DNS быть не должно: на хостнейм с CNAME Custom
  Domain не встанет.
- Записи GitHub Pages (`A` на `185.199.108–111.153`, `www` CNAME) оставьте серыми, DNS only.
  Через прокси Cloudflare сайт попадёт под замедление в России.
- Кошелёк ЮMoney именной или идентифицированный: с анонимного собирать нельзя.

Бесплатного плана хватает: Workers 100 000 запросов в сутки, D1 5 млн чтений и 100 000
записей строк в сутки, cron до 5 на аккаунт.

```bash
cd worker
npm install --legacy-peer-deps
npm test
npx wrangler login
npx wrangler d1 create fabbit-donate
```

`d1 create` выдаёт `database_id`. В репозитории он не хранится: в `wrangler.jsonc` нули,
настоящий id живёт в `wrangler.prod.jsonc`, файл в `.gitignore`. Соберите его из основного
(и пересобирайте после каждой правки `wrangler.jsonc`):

```bash
sed 's/00000000-0000-0000-0000-000000000000/<database_id>/' wrangler.jsonc > wrangler.prod.jsonc
```

Все команды к Cloudflare ниже идут с `-c wrangler.prod.jsonc`. Тесты и `wrangler dev`
работают с `wrangler.jsonc` и локальной базой.

```bash
npx wrangler d1 migrations apply fabbit-donate --remote -c wrangler.prod.jsonc
npm run deploy
npx wrangler secret put YOOMONEY_SECRET -c wrangler.prod.jsonc
```

`npm run deploy` (`wrangler deploy -c wrangler.prod.jsonc`) создаёт воркер и `donate.fabbit.dev`. Пока секрета нет, воркер отвечает на уведомления
`400`. `secret put` спрашивает значение, сохраняет его и сразу выкатывает новую версию.
Секрет берите в ЮMoney (следующий раздел). В репозиторий и `wrangler.jsonc` его не пишите.
Проверка: `curl https://donate.fabbit.dev/stats` отдаёт `{"total_kop":0,...}`.
Логи: `npx wrangler tail -c wrangler.prod.jsonc`.

### Уведомления в ЮMoney

1. Откройте [настройки HTTP-уведомлений](https://yoomoney.ru/transfer/myservices/http-notification).
2. Адрес: `https://donate.fabbit.dev/yoomoney`.
3. Поставьте галочку «Отправлять HTTP-уведомления», нажмите «Готово».
4. «Показать секрет»: этот секрет введите в `wrangler secret put YOOMONEY_SECRET`.
   Сменили секрет в ЮMoney: повторите `secret put`.

ЮMoney засчитывает только ответ `200` и повторяет уведомление через 10 минут и через час.
Адрес уведомлений у кошелька один.

Комиссию ЮMoney вычитает из перевода: 3% с карты, 1% с кошелька. Сумма перевода от 2
до 15 000 ₽. Тестового режима у формы нет: ЮKassa с тестовым магазином сюда не подходит.

### Тестовое уведомление

Кнопка «Протестировать» в настройках шлёт тестовое уведомление. Воркер отвечает `200`
и ничего не записывает. Держите открытым `npx wrangler tail -c wrangler.prod.jsonc`: в нём видно, что запрос дошёл.
Если в логе `bad sign`, ЮMoney прислал тест без подписи: адрес рабочий, проверьте приём скриптом ниже.

Подписанное уведомление со своей суммой:

```bash
cd worker
SECRET=<секрет> node scripts/notify.mjs https://donate.fabbit.dev 100.00
```

Скрипт печатает `operation_id`. Сумма попадает в итог, поэтому после проверки удалите строку:

```bash
npx wrangler d1 execute fabbit-donate --remote -c wrangler.prod.jsonc --command "DELETE FROM donations WHERE operation_id = 'manual-…'"
```

Последняя проверка: настоящий платёж на 100 ₽ с сайта. Деньги придут на ваш же кошелёк,
потеряете только комиссию (3 ₽ с карты). Уведомление ЮMoney приходит из России.
Если в `wrangler tail` его нет, адреса Cloudflare режет провайдер ЮMoney. Тогда
`/yoomoney` придётся перенести на хостинг в России.

### Настоящий платёж на локальном воркере

Уведомление ЮMoney должно дойти до `wrangler dev`, поэтому нужен публичный адрес:
быстрый туннель Cloudflare, без аккаунта.

1. `cd worker && npx wrangler dev --port 8787`, в корне `npm run dev`.
2. `cloudflared tunnel --url http://localhost:8787` печатает `https://….trycloudflare.com`.
   Адрес меняется при каждом запуске.
3. В настройках HTTP-уведомлений ЮMoney адрес `https://….trycloudflare.com/yoomoney`,
   «Готово». «Показать секрет» → `YOOMONEY_SECRET` в `worker/.dev.vars`, перезапустите `wrangler dev`.
4. «Протестировать»: в логе `wrangler dev` появится `POST /yoomoney`.
5. На `http://localhost:5190/#support` 100 ₽ картой. После оплаты ЮMoney вернёт на
   `fabbit.dev/thanks/`; донат смотрите на localhost.
6. Верните в ЮMoney адрес `https://donate.fabbit.dev/yoomoney`.

### Модерация

Спрятать имя и сообщение доната. Сумма остаётся в итоге, донат показан анонимом:

```bash
npx wrangler d1 execute fabbit-donate --remote -c wrangler.prod.jsonc --command "UPDATE donations SET hidden = 1 WHERE operation_id = '…'"
```

Последние донаты с `operation_id`:

```bash
npx wrangler d1 execute fabbit-donate --remote -c wrangler.prod.jsonc --command "SELECT operation_id, name, message, amount_kop FROM donations ORDER BY paid_at DESC LIMIT 20"
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

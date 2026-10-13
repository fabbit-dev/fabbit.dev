-- заявка до оплаты: label уходит в форму ЮMoney, имя и сообщение ждут уведомления
CREATE TABLE pending (
  label      TEXT PRIMARY KEY,
  name       TEXT,
  message    TEXT,
  created_at INTEGER NOT NULL
);

-- оплаченный донат; operation_id из уведомления, повтор уведомления не создаёт второй строки
CREATE TABLE donations (
  operation_id TEXT PRIMARY KEY,
  amount_kop   INTEGER NOT NULL,   -- amount: дошло до кошелька, в копейках
  name         TEXT,               -- NULL: аноним
  message      TEXT,
  paid_at      TEXT NOT NULL,      -- datetime из уведомления
  hidden       INTEGER NOT NULL DEFAULT 0   -- 1: скрыть имя и сообщение (модерация вручную)
);
CREATE INDEX donations_paid_at ON donations (paid_at);

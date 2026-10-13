import { beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// D1 общая на файл: каждый тест с пустыми таблицами
beforeEach(() => env.DB.batch([env.DB.prepare('DELETE FROM donations'), env.DB.prepare('DELETE FROM pending')]));

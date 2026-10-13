import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      // явные значения: локальный .dev.vars (wrangler dev) в тесты не попадает
      miniflare: { bindings: { YOOMONEY_SECRET: 'test-secret', ALLOWED_ORIGIN: 'https://fabbit.dev', TEST_MIGRATIONS: migrations } },
    })],
    test: { setupFiles: ['./test/setup.js'] },
  };
});

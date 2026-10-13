import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { YOOMONEY_SECRET: 'test-secret', TEST_MIGRATIONS: migrations } },
    })],
    test: { setupFiles: ['./test/setup.js'] },
  };
});

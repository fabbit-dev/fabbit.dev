import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';

export default defineConfig({
  plugins: [cloudflareTest({
    wrangler: { configPath: './wrangler.jsonc' },
    // явные значения: локальный .dev.vars (wrangler dev) в тесты не попадает. S3 подменяет test/s3mock.js
    miniflare: { bindings: {
      YOOMONEY_SECRET: 'test-secret', ALLOWED_ORIGIN: 'https://fabbit.dev',
      S3_ENDPOINT: 'https://s3.test', S3_BUCKET: 'bucket', S3_REGION: 'ru-central-1', S3_KEY_ID: 'tenant:key', S3_SECRET: 's3-secret',
    } },
  })],
  test: { setupFiles: ['./test/setup.js'] },
});

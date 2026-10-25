// npm run model:optimize. Генераторы локальные; в Git только готовые ассеты.
import { existsSync } from 'node:fs';
const source = new URL('../.dev/model/optimize-model.mjs', import.meta.url);
if (!existsSync(source)) throw new Error('Нет локального генератора .dev/model/optimize-model.mjs');
await import(source.href);

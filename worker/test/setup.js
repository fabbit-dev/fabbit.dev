import { beforeEach, vi } from 'vitest';
import { objects, opts, s3fetch } from './s3mock.js';

vi.stubGlobal('fetch', s3fetch);

// бакет общий на файл: каждый тест с пустым
beforeEach(() => {
  objects.clear();
  opts.pageSize = 1000;
});

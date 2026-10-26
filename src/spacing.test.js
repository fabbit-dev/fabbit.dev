import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/style.css', 'utf8');
const island = readFileSync('src/build/island.css', 'utf8');
const main = readFileSync('src/main.js', 'utf8');

describe('единый ритм интерфейса', () => {
  it('определяет роли на существующей шкале отступов', () => {
    for (const token of ['space-heading', 'space-content', 'space-grid', 'space-columns', 'space-card', 'space-card-stack']) {
      expect(css).toMatch(new RegExp(`--${token}: var\\(--s\\d\\)`));
    }
    expect(css).toContain('--section: var(--s9)');
    expect(css).toContain('--control: 44px');
  });

  it('разделяет единые отступы с React-островом', () => {
    expect(island).toContain('.build__grid { gap: var(--space-grid); }');
    expect(island).toMatch(/\.build-part \{[^}]*gap: var\(--space-card-stack\)[^}]*padding-block: var\(--space-card\)/);
    expect(island).toContain('padding-inline: var(--space-card)');
    expect(island).toMatch(/\.build__head \{[^}]*margin-bottom: var\(--space-content\)/);
  });

  it('берёт отступы 3D-полосы из CSS, а не дублирует числа', () => {
    expect(main).toContain('function measureSpacing()');
    expect(main).toContain("space['hero-pad-start'] + space['hero-pad-end']");
    expect(main).toContain("2 * space['screen-gutter']");
    expect(main).not.toContain('brand.offsetTop + 24 + 32');
  });

  it('использует адаптивный отступ заголовка над статистикой сбора', () => {
    expect(css).toMatch(/\.stats \{[^}]*padding-top: var\(--space-heading\)/);
  });

  it('держит строки шкалы на сетке 4 px, резервирует место под прогноз', () => {
    for (const cls of ['goal__heading', 'goal__ticks', 'goal__note']) {
      expect(css).toMatch(new RegExp(`\\.${cls} \\{[^}]*line-height: var\\(--s4\\)`));
    }
    expect(css).toMatch(/\.goal__note \{[^}]*min-height: var\(--s4\)/);
    expect(css).toMatch(/\.goal__ticks \{[^}]*margin-top: var\(--s2\)/);
    expect(css).toMatch(/\.goal__note \{[^}]*margin: var\(--s3\) 0 0/);
  });
});

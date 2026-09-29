import { describe, it, expect } from 'vitest';
import { PARTS } from './parts.js';
import { pick } from '../i18n.js';

// Строки из старой таблицы «Характеристики» (index.html до объединения глав 04 и 05).
// Ни одна цифра не должна потеряться при переносе в блоки.
const OLD_SPECS = [
  ['ПЛИС', 'Artix-7, модуль Colorlight i9+'],
  ['Микроконтроллер', 'ESP32-C3, Wi-Fi и Bluetooth LE'],
  ['Экран', '3,5″, модуль 70 × 51 мм'],
  ['Корпус', '88 × 150 × 22 мм'],
  ['Управление', 'крестовина, F1–F4, Fn, Меню, Назад, колесо'],
  ['Входы', '2 × SMA через мезонин АЦП'],
  ['Видео', 'HDMI Type A'],
  ['Порты', 'USB-C, microSD'],
  ['Выводы', 'гребёнки A и B по 2 × 10, питание 2 × 2'],
  ['Расширение', 'мезонин на разъёме 60 контактов'],
  ['Питание', 'Li-Pol 1S, 65 × 40 × 9 мм'],
];

const allSpecs = (lang = 'ru') => PARTS.flatMap((p) => p.specs.map(([k, v]) => [pick(k, lang), pick(v, lang)]));

describe('состав прибора', () => {
  it.each(OLD_SPECS)('сохраняет строку «%s»', (label, value) => {
    expect(allSpecs()).toContainEqual([label, value]);
  });

  it('порты прибора описаны у разъёмов, у компьютера — только связь', () => {
    const host = PARTS.find((p) => p.id === 'host');
    expect(host.specs.map(([k, v]) => [pick(k, 'ru'), pick(v, 'ru')])).toContainEqual(['Связь', 'USB-C']);
    expect(allSpecs().map(([, v]) => v).join(' ')).toMatch(/microSD/);
  });


  it('объясняет каждую часть одной короткой фразой', () => {
    for (const p of PARTS) {
      for (const lang of ['ru', 'en']) {
        expect(pick(p.what, lang).length, `${p.id} ${lang}`).toBeGreaterThan(40);
        expect(pick(p.what, lang).length, `${p.id} ${lang}`).toBeLessThanOrEqual(120);
      }   // карточка читается за секунду
      expect(p.role, p.id).toBeUndefined();
    }
  });

  it('в английской версии те же цифры и нет кириллицы', () => {
    expect(allSpecs('en')).toHaveLength(allSpecs('ru').length);
    for (const p of PARTS) {
      const en = [pick(p.title, 'en'), pick(p.what, 'en'), ...p.specs.flat().map((v) => pick(v, 'en')), ...(p.tag ?? []).map((v) => pick(v, 'en'))];
      for (const t of en) expect(t, p.id).not.toMatch(/[А-Яа-яЁё]/);
    }
  });

  it('содержит ПЛИС, микроконтроллер и прошивку', () => {
    expect(PARTS.map((p) => pick(p.title, 'ru'))).toEqual(expect.arrayContaining(['ПЛИС', 'Микроконтроллер', 'Прошивка']));
  });

});

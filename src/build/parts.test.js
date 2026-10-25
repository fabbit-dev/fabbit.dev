import { describe, it, expect } from 'vitest';
import { PARTS, nbsp } from './parts.js';
import { pick } from '../i18n.js';

// Неизменённые строки: геометрия, разъёмы и питание обновляются следующими шагами аудита.
const UNCHANGED_SPECS = [
  ['ПЛИС', 'Artix-7, модуль Colorlight i9+'],
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
  it.each(UNCHANGED_SPECS)('сохраняет пока неизменённую строку «%s»', (label, value) => {
    expect(allSpecs()).toContainEqual([label, value]);
  });

  it.each(['ru', 'en'])('отделяет супервизор H417 от радио C5 (%s)', (lang) => {
    const mcu = PARTS.find((p) => p.id === 'mcu');
    const radio = PARTS.find((p) => p.id === 'radio');
    expect(pick(mcu.what, lang)).toMatch(/CH32H417/);
    expect(pick(mcu.what, lang)).not.toMatch(/ESP32|Wi-Fi|BLE/);
    expect(pick(radio.what, lang)).toMatch(/ESP32-C5/);
    expect(radio.specs.map(([, v]) => pick(v, lang)).join(' ')).toMatch(/Wi-Fi 6.*BLE 5.*802\.15\.4/);
    expect(JSON.stringify(PARTS)).not.toContain('ESP32-C3');
  });

  it.each(['ru', 'en'])('описывает USB3/UHSIF как целевой транспорт, не измеренный поток (%s)', (lang) => {
    const host = PARTS.find((p) => p.id === 'host');
    expect(pick(host.what, lang)).toMatch(/CH32H417.*USB 3\.0/);
    expect(pick(host.what, lang)).toMatch(lang === 'ru' ? /Планируем/ : /We plan/);
    expect(host.specs.map(([, v]) => pick(v, lang)).join(' ')).toMatch(/UHSIF/);
    expect(host.specs.map(([, v]) => pick(v, lang)).join(' ')).toMatch(/16/);
    expect(pick(host.note, lang)).toMatch(lang === 'ru' ? /5 Гбит\/с.*скорость линии USB.*ещё не измерен/ : /5 Gbit\/s.*USB line rate.*has not been measured/);
    expect(allSpecs().map(([, v]) => v).join(' ')).toMatch(/microSD/);
  });

  it('не отрывает новые единицы частоты и транспорта от чисел', () => {
    expect(nbsp('5 Гбит/с, 5 ГГц, 16 бит')).toBe('5\u00a0Гбит/с, 5\u00a0ГГц, 16\u00a0бит');
    expect(nbsp('5 Gbit/s, 5 GHz', 'en')).toBe('5\u00a0Gbit/s, 5\u00a0GHz');
  });

  it('объясняет каждую часть одной короткой фразой', () => {
    for (const p of PARTS) {
      for (const lang of ['ru', 'en']) {
        expect(pick(p.what, lang).length, `${p.id} ${lang}`).toBeGreaterThan(p.id === 'radio' ? 30 : 40);
        expect(pick(p.what, lang).length, `${p.id} ${lang}`).toBeLessThanOrEqual(120);
      }   // карточка читается за секунду
      expect(p.role, p.id).toBeUndefined();
    }
  });

  it('в английской версии те же цифры и нет кириллицы', () => {
    expect(allSpecs('en')).toHaveLength(allSpecs('ru').length);
    for (const p of PARTS) {
      const en = [pick(p.title, 'en'), pick(p.what, 'en'), ...p.specs.flat().map((v) => pick(v, 'en')), ...(p.tag ?? []).map((v) => pick(v, 'en')), ...(p.note ? [pick(p.note, 'en')] : [])];
      for (const t of en) expect(t, p.id).not.toMatch(/[А-Яа-яЁё]/);
    }
  });

  it('содержит ПЛИС, микроконтроллер и прошивку', () => {
    expect(PARTS.map((p) => pick(p.title, 'ru'))).toEqual(expect.arrayContaining(['ПЛИС', 'Микроконтроллер', 'Прошивка']));
  });

});

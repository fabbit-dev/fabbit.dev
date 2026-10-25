import { describe, it, expect } from 'vitest';
import { PARTS, nbsp } from './parts.js';
import { pick } from '../i18n.js';

// Геометрия корпуса обновляется следующим шагом вместе с моделью.
const UNCHANGED_SPECS = [
  ['ПЛИС', 'Artix-7, модуль Colorlight i9+'],
  ['Экран', '3,5″, модуль 70 × 51 мм'],
  ['Корпус', '90 × 150 × 22,5 мм; над аналоговым модулем 24 мм'],
  ['Управление', 'крестовина, F1–F4, Fn, Меню, Назад, колесо'],
  ['Видео', 'HDMI Type A'],
  ['Порты', 'USB-C, microSD'],
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

  it.each(['ru', 'en'])('сохраняет USB3/H417/UHSIF без отчёта о разработке (%s)', (lang) => {
    const host = PARTS.find((p) => p.id === 'host');
    expect(pick(host.what, lang)).toContain('CH32H417');
    expect(pick(host.what, lang)).toContain('USB 3.0');
    expect(host.specs.map(([, v]) => pick(v, lang)).join(' ')).toMatch(/UHSIF/);
    expect(host.specs.map(([, v]) => pick(v, lang)).join(' ')).toMatch(/16/);
    expect(host.note).toBeUndefined();
    expect(pick(host.what, lang)).not.toMatch(/Планируем|We plan|измерен|measured/);
    expect(allSpecs().map(([, v]) => v).join(' ')).toMatch(/microSD/);
  });

  it('не отрывает новые единицы частоты и транспорта от чисел', () => {
    expect(nbsp('5 Гбит/с, 5 ГГц, 16 бит')).toBe('5\u00a0Гбит/с, 5\u00a0ГГц, 16\u00a0бит');
    expect(nbsp('5 Gbit/s, 5 GHz', 'en')).toBe('5\u00a0Gbit/s, 5\u00a0GHz');
    expect(nbsp('2800 мА·ч, 3–9 ч')).toBe('2800\u00a0мА·ч, 3–9\u00a0ч');
    expect(nbsp('2800 mAh, 3–9 hours', 'en')).toBe('2800\u00a0mAh, 3–9\u00a0hours');
  });

  it.each(['ru', 'en'])('описывает три SMA, разные цифровые порты и BergStak (%s)', (lang) => {
    const ports = PARTS.find((p) => p.id === 'ports');
    const values = ports.specs.map(([, v]) => pick(v, lang)).join(' ');
    expect(values).toMatch(/3 × SMA.*CH1\/CH2.*GEN/);
    expect(values).toMatch(/A 2 × 12, B 2 × 10.*2 × 2/);
    expect(ports.specs.map(([k]) => pick(k, lang))).toContain('MIPI-20');
    expect(values).toMatch(lang === 'ru' ? /SWD, JTAG, trace 4 бит/ : /SWD, JTAG, 4-bit trace/);
    expect(values).toMatch(lang === 'ru' ? /BergStak: 80 контактов, шаг 0,8 мм, стек 9 мм/ : /BergStak: 80 contacts, 0\.8 mm pitch, 9 mm stack height/);
    expect(values).toMatch(lang === 'ru' ? /осциллограф, генератор и мультиметр/ : /oscilloscope, signal generator and multimeter/);
    expect(values).not.toMatch(/60 контактов|60-pin|ADC mezzanine|мезонин АЦП/);
  });

  it.each(['ru', 'en'])('разделяет USB-C, аккумулятор и расчётную автономность (%s)', (lang) => {
    const part = PARTS.find((p) => p.id === 'case');
    const specs = part.specs.map(([k, v]) => [pick(k, lang), pick(v, lang)]);
    expect(specs).toContainEqual(['USB-C', lang === 'ru' ? 'PD 3.1: заряд аккумулятора и выход 5 В до 1 А' : 'PD 3.1: battery charging and 5 V output up to 1 A']);
    expect(specs).toContainEqual(lang === 'ru' ? ['Аккумулятор', 'Li-pol 1S, 2800 мА·ч'] : ['Battery', 'Li-Po 1S, 2800 mAh']);
    expect(specs).toContainEqual(lang === 'ru' ? ['Расчётная автономность', '3–9 ч по режимам'] : ['Estimated runtime', '3–9 hours depending on mode']);
    expect(part.source.href).toBe('https://github.com/fabbit-dev/fabbit/blob/main/journal/2026-10-17.md');
    expect(pick(part.source.label, lang)).toBe(lang === 'ru' ? 'Расчёт' : 'Calculation');
    expect(JSON.stringify(part)).not.toContain('65 × 40 × 9');
  });

  it('объясняет каждую часть одной короткой фразой', () => {
    for (const p of PARTS) {
      for (const lang of ['ru', 'en']) {
        expect(pick(p.what, lang).length, `${p.id} ${lang}`).toBeGreaterThan(30);
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

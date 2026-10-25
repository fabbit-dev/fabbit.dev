import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { PROFILES } from './profiles.js';
import { pick } from './i18n.js';

describe('целевые функции', () => {
  it('соответствует выбранному набору, без ранних идей среди приборов', () => {
    expect(PROFILES.map((p) => p.id)).toEqual(['logic', 'scope', 'debug', 'generator', 'multimeter', 'psu', 'glitch', 'retro']);
    expect(new Set(PROFILES.map((p) => p.id)).size).toBe(PROFILES.length);
  });

  it('каждая функция имеет SVG и иконку экранного атласа', () => {
    const atlas = JSON.parse(readFileSync('public/brand/icons/atlas-16.json', 'utf8'));
    for (const p of PROFILES) {
      expect(existsSync(`public/brand/icons/${p.icon}.svg`), p.id).toBe(true);
      expect(atlas[p.icon], p.id).toEqual(expect.any(Number));
    }
  });

  it.each(['ru', 'en'])('сохраняет диапазоны и условия характеристик (%s)', (lang) => {
    const desc = (id) => pick(PROFILES.find((p) => p.id === id).desc, lang);
    expect(desc('logic')).toMatch(/16.*0–10.*±30.*8.*(?:1,1–4,7|1\.1–4\.7).*50 MS\/s.*16.*100 MS\/s.*8/);
    expect(desc('debug')).toMatch(/CMSIS-DAP v2.*SWD.*JTAG.*4.*MIPI-20/);
    expect(desc('generator')).toMatch(lang === 'ru' ? /14 бит.*9,6 Впп без нагрузки.*4,8 Впп на 50 Ом/ : /14-bit.*9\.6 Vpp unloaded.*4\.8 Vpp into 50 Ω/);
    expect(desc('multimeter')).toMatch(/ADS1220.*24|24.*ADS1220/);
    expect(desc('multimeter')).toContain('CH32H417');
    expect(desc('psu')).toMatch(lang === 'ru' ? /0,8–22 В.*20 Вт от PD.*5 Вт от батареи.*0,2 мкА…3 А при выходе до 5,5 В/ : /0\.8–22 V.*20 W from PD.*5 W from the battery.*0\.2 µA to 3 A at output voltages up to 5\.5 V/);
    expect(desc('glitch')).not.toMatch(/такт|clock|40|ns|нс/);
    expect(desc('retro')).toMatch(lang === 'ru' ? /Ретро-ядра на экране и HDMI/ : /Retro cores on the screen and HDMI/);
    expect(desc('retro')).not.toMatch(/стенд|bench|ESP32-S3/);
  });
});

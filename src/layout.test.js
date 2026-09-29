import { describe, it, expect } from 'vitest';
import { slotY, isMobileWidth, MOBILE_MAX, stageHeight, isPhoneLayout, isLandscapePhone } from './layout.js';

describe('slotY: прибор по вертикали между навигацией и карточкой текста', () => {
  it('ставит прибор по центру свободной полосы и вписывает по высоте с отступами', () => {
    // кадр 800 px, навигация кончается на 80, карточка начинается с 480, отступ 16
    const { y, h } = slotY({ top: 80, bottom: 480, frameH: 800, pad: 16 });
    expect(h).toBeCloseTo(368 / 800, 5);   // (480 − 80 − 2·16) / 800
    expect(y).toBeCloseTo(0.3, 5);         // центр полосы 280 px, от центра кадра вверх на 120 из 400
  });

  it('учитывает, что силуэт в ракурсе выше корпуса', () => {
    const { h } = slotY({ top: 80, bottom: 480, frameH: 800, pad: 16, silhouette: 1.15 });
    expect(h).toBeCloseTo(368 / 800 / 1.15, 5);
  });

  it('не раздувает прибор больше hMax и не сжимает меньше hMin', () => {
    expect(slotY({ top: 0, bottom: 2000, frameH: 800, pad: 0 }).h).toBe(0.92);
    expect(slotY({ top: 400, bottom: 410, frameH: 800, pad: 16 }).h).toBe(0.2);
  });
});

describe('isMobileWidth: одна граница для CSS и JS', () => {
  it('860 px и уже — мобильная раскладка, как @media (max-width: 860px)', () => {
    expect(MOBILE_MAX).toBe(860);
    expect(isMobileWidth(860)).toBe(true);
    expect(isMobileWidth(861)).toBe(false);
  });
});

describe('stageHeight: полоса прибора на телефоне', () => {
  it('отдаёт прибору всё, что не занимает самая высокая карточка текста', () => {
    expect(stageHeight({ vh: 860, cards: [300, 340, 280] })).toBe(520);
  });
  it('не меньше 45% и не больше 70% экрана', () => {
    expect(stageHeight({ vh: 600, cards: [500] })).toBe(270);
    expect(stageHeight({ vh: 1000, cards: [100] })).toBe(700);
  });
});

describe('isPhoneLayout: телефон на боку получает раскладку широкого экрана', () => {
  it('телефон стоя — полоса прибора сверху', () => {
    expect(isPhoneLayout(375, 812)).toBe(true);
    expect(isPhoneLayout(360, 640)).toBe(true);
  });
  it('телефон на боку — текст слева, прибор справа', () => {
    expect(isLandscapePhone(812, 375)).toBe(true);
    expect(isPhoneLayout(812, 375)).toBe(false);
    expect(isLandscapePhone(915, 412)).toBe(true);
  });
  it('планшет на боку остаётся широким экраном, узкое высокое окно — телефонным', () => {
    expect(isLandscapePhone(1024, 768)).toBe(false);
    expect(isPhoneLayout(700, 900)).toBe(true);
    expect(isPhoneLayout(800, 600)).toBe(true);   // выше 500 px: полоса и карточка помещаются
  });
});

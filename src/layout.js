// Раскладка прибора и общая граница мобильной версии. Чистые функции, без DOM.

// Та же граница, что в CSS: @media (max-width: 860px)
export const MOBILE_MAX = 860;
export const isMobileWidth = (w) => w <= MOBILE_MAX;

// Телефон на боку: полоса прибора сверху и карточка под ней по высоте не помещаются,
// поэтому там раскладка широкого экрана (текст слева, прибор справа), только плотнее.
// В CSS то же самое: (orientation: landscape) and (max-height: 500px).
export const LANDSCAPE_MAX_H = 500;
export const isLandscapePhone = (w, h) => w > h && h <= LANDSCAPE_MAX_H;
// Раскладка «прибор сверху, текст снизу»: узкий экран, но не телефон на боку.
// В CSS: (max-width: 860px) and ((orientation: portrait) or (min-height: 501px)).
export const isPhoneLayout = (w, h) => isMobileWidth(w) && !isLandscapePhone(w, h);

// На телефоне прибор стоит в полосе между навигацией (top) и карточкой текста (bottom), px от верха кадра.
// Возвращает положение в единицах сцены: y — доля половины кадра вверх от центра, h — доля высоты кадра
// под высоту корпуса. silhouette — во сколько раз силуэт в этом ракурсе выше корпуса.
export function slotY({ top, bottom, frameH, pad = 16, silhouette = 1, hMin = 0.2, hMax = 0.92 }) {
  const free = Math.max(0, bottom - top - 2 * pad);
  const h = Math.min(hMax, Math.max(hMin, free / frameH / silhouette));
  const y = (frameH / 2 - (top + bottom) / 2) / (frameH / 2);
  return { y, h };
}

// Телефон: высота полосы прибора. Прибору достаётся всё, что не занимает самая высокая карточка текста,
// но не меньше 45% и не больше 70% экрана. Карточки прижаты к низу, так что текст всегда целиком.
export function stageHeight({ vh, cards }) {
  const free = vh - Math.max(0, ...cards);
  return Math.round(Math.min(vh * 0.7, Math.max(vh * 0.45, free)));
}

// Язык страницы: корень fabbit.dev — русский, fabbit.dev/en/ — английский (en/index.html).
// Скрипты берут язык из <html lang>; на сборке (Node, без document) язык передаётся параметром.
export const LANG = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ru';

// Двуязычное значение { ru, en } → строка нужного языка; обычное значение возвращается как есть.
export const pick = (v, lang = LANG) => (v && typeof v === 'object' && !Array.isArray(v) && 'ru' in v ? v[lang] : v);

export const LANG_KEY = 'fabbit-lang';   // выбор из переключателя в шапке, localStorage
export const BOT_RE = /bot|crawl|spider|slurp|lighthouse/i;

// Куда отправить посетителя корня (/). Сохранённый выбор главнее автоопределения; русский — если ru есть
// среди языков браузера; поисковых роботов не переадресуем, чтобы они индексировали русскую версию.
// Та же логика инлайном стоит в <head> index.html (i18n.test.js сверяет их поведение).
export function pickStartLang({ path = '/', saved = null, languages = [], ua = '' } = {}) {
  if (path !== '/') return null;
  if (saved === 'ru' || saved === 'en') return saved;
  if (BOT_RE.test(ua)) return 'ru';
  return languages.some((l) => String(l).toLowerCase().startsWith('ru')) ? 'ru' : 'en';
}

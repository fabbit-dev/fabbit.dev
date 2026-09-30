// Inter: переменный шрифт, браузер качает только нужные наборы (латиница, кириллица) по unicode-range.
// JetBrains Mono: только латиница и кириллица в двух начертаниях.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/cyrillic-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/cyrillic-700.css';
import './style.css';
import './build/island.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PROFILES } from './profiles.js';
import { LANG, LANG_KEY, pick } from './i18n.js';
import { mountBunny } from './bunny.js';
import { mountHighFive } from './highfive.js';
import { mountMenu } from './menu.js';
import { isPhoneLayout, isLandscapePhone, slotY, stageHeight } from './layout.js';
import { mountChipFlights } from './chipFlight.js';

gsap.registerPlugin(ScrollTrigger);
document.documentElement.classList.add('js');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const mobile = () => isPhoneLayout(innerWidth, innerHeight);
const nav = $('#nav');

// Модель и затенение качаются заранее, параллельно с чанком three.js, — но только там, где будет 3D.
if (webglOK()) {
  for (const [href, as] of [['/models/fabbit_v1.glb', 'fetch'], ['/models/fabbit_ao.webp', 'image']]) {
    document.head.append(Object.assign(document.createElement('link'), { rel: 'preload', href, as, crossOrigin: 'anonymous' }));
  }
}

// Телефон: высота полосы прибора (CSS --stage-h) = экран минус самая высокая карточка текста.
// Карточки прижаты к низу, прибору остаётся всё свободное место сверху.
let stageH = innerHeight, storyTail = 0;
// Низ карточек текста, px: они прижаты к 100svh. innerHeight на телефоне растёт, когда прячется панель адреса,
// и всё, что считалось от него (подписи, прибор), съезжало на текст. Полоса прибора сама высотой 100svh.
let svhPx = innerHeight;
const nat = {};   // телефон: высота текста глав истории, по id секции
const root = document.documentElement.style;
function layoutStage() {
  if (!mobile()) { for (const v of ['--stage-h', '--nat-profiles', '--nat-blueprint', '--canvas-h']) root.removeProperty(v); stageH = svhPx = innerHeight; storyTail = 0; bandBg(); return; }
  svhPx = $('.stage').offsetHeight || innerHeight;
  // hero тоже карточка: логотип, заголовок и кнопки должны влезть под полосу с запасом 24 px снизу
  // по offsetTop: анимация появления сдвигает блоки transform-ом и сбила бы замер
  const brand = $('.hero__brand'), actions = $('.hero .actions');
  const hero = actions.offsetTop + actions.offsetHeight - brand.offsetTop + 24 + 32;   // + отступы .hero__inner сверху и снизу
  // карточки растянуты до низа экрана (CSS), а полосе нужна высота их текста: на время замера растяжку снимаем
  document.documentElement.classList.add('is-measuring');
  const cards = $$('.sticky .wrap').map((w) => w.offsetHeight);
  document.documentElement.classList.remove('is-measuring');
  stageH = stageHeight({ vh: innerHeight, cards: [hero, ...cards] });
  root.setProperty('--stage-h', `${stageH}px`);
  // высота текста каждой главы: текст прижат к низу экрана, всё выше него — место прибора (band в init3D)
  $$('.sticky .wrap').forEach((w, i) => { nat[w.closest('section').id] = cards[i]; });
  nat.hero = hero;   // текст hero тоже прижат к низу экрана: прибор в hero растёт до заголовка
  root.setProperty('--nat-profiles', `${nat.profiles}px`);
  root.setProperty('--nat-blueprint', `${nat.blueprint}px`);
  // холст кончается над самым коротким текстом: ниже него только текст, и касания уходят к нему
  root.setProperty('--canvas-h', `${svhPx - Math.min(hero, ...cards)}px`);
  // полоса во всю высоту уезжает вместе с последней главой, как только та начинает уходить
  storyTail = 0;
  bandBg();
}
// Цвет полосы на телефоне — «шторкой». Тёмная глава «Профили» поднимается снизу, а над её краем такой же
// тёмный лист идёт быстрее прокрутки и закрывает полосу целиком ровно тогда, когда карточка главы встаёт
// под полосу (E: от низа экрана до 0). На выходе так же быстрее поднимается белый лист следующей главы (F).
// Ниже края главы фон не рисуется: там текст карточки, он лежит под холстом.
// Стили пишутся, только когда изменились: маска на холсте перерисовывает весь его слой,
// а вне «Профилей» и hero градиент и маска на каждом шаге прокрутки одни и те же.
const bandPrev = { bg: null, mask: null };
function setBand(bg, mask, composite = '') {
  if (bg !== bandPrev.bg) { bandPrev.bg = bg; $('.stage').style.background = bg; }
  if (mask === bandPrev.mask) return;
  bandPrev.mask = mask;
  const gl = $('#gl').style;
  gl.maskImage = gl.webkitMaskImage = mask;
  gl.maskComposite = composite === 'source-in' ? 'intersect' : ''; gl.webkitMaskComposite = composite;
}
function bandBg() {
  if (!mobile()) { setBand('', ''); return; }
  const r = $('#profiles').getBoundingClientRect(), vh = innerHeight, H = stageH;
  const fast = (edge) => Math.round(Math.max(0, vh * (edge - H) / (vh - H)));
  const W = '#fff', D = '#0A0A0A';
  let g;
  if (r.top >= vh || r.bottom <= H) g = `${W} ${H}px, transparent ${H}px`;
  else if (r.top > H) {
    // белое только в самой полосе: текст hero под ней виден, пока до него не дошёл тёмный лист
    const E = fast(r.top), T = Math.round(r.top), a = Math.min(E, H);
    g = `${W} ${a}px, transparent ${a}px ${E}px, ${D} ${E}px ${T}px, transparent ${T}px`;
  }
  else if (r.bottom < vh) { const F = fast(r.bottom); g = `${D} ${F}px, ${W} ${F}px ${Math.round(r.bottom)}px, transparent ${Math.round(r.bottom)}px`; }
  else g = `${D} ${H}px, transparent ${H}px`;
  const bg = `linear-gradient(${g})`;
  // Под полосой холст прозрачный, но в hero и «Профилях» прибор обрезан по низу полосы, как раньше:
  // иначе растущий к экрану корпус лёг бы на текст hero, а в профилях под экраном торчал бы корпус.
  // Когда «Профили» уезжают вверх, обрезка плавно опускается до низа холста — к «Разборке» прибор снова целиком.
  const canvasH = svhPx - Math.min(...Object.values(nat));
  // выход из главы — от «карточка начала уезжать» (низ главы у низа экрана) до «глава ушла под полосу»
  // hero: край — верх заголовка; уезжая вверх, текст закрывает прибор снизу и не ложится на него
  const heroTop = $('.hero__title').getBoundingClientRect().top - 12;
  const clip = r.top > stageH ? Math.max(stageH, Math.min(canvasH, heroTop))
    : r.bottom >= innerHeight ? stageH : r.bottom <= stageH ? canvasH
    : stageH + (canvasH - stageH) * (innerHeight - r.bottom) / (innerHeight - stageH);
  // На подходе к «Профилям» и выходе из них корпус не растворяется в серую муть, а «сжимается в экран»:
  // маска сужается до прямоугольника плоского экрана (и расширяется обратно на выходе)
  const approach = r.top > stageH && r.top < innerHeight ? (innerHeight - r.top) / (innerHeight - stageH) : 0;
  const leave = r.bottom < innerHeight && r.bottom > stageH ? (innerHeight - r.bottom) / (innerHeight - stageH) : -1;
  const t = approach ? Math.min(1, Math.max(0, (approach - 0.45) / 0.48)) : leave >= 0 ? Math.max(0, 1 - leave / 0.6) : 0;
  if (t > 0) {
    const f = flatRect(), mg = (1 - t) * 420, e = 18;   // запас вокруг экрана и мягкость края, px
    const x0 = f.x0 - mg, x1 = f.x1 + mg, y0 = f.y0 - mg, y1 = Math.min(f.y1 + mg, clip);
    const mx = `linear-gradient(to right, transparent ${x0 - e}px, #000 ${x0}px, #000 ${x1}px, transparent ${x1 + e}px)`;
    const my = `linear-gradient(transparent ${y0 - e}px, #000 ${y0}px, #000 ${y1 - e}px, transparent ${y1}px)`;
    setBand(bg, `${mx}, ${my}`, 'source-in');
    return;
  }
  // край обрезки — мягкий: корпус растворяется на 56 px, а не режется ровной линией
  setBand(bg, clip < canvasH ? `linear-gradient(#000 ${Math.round(clip - 56)}px, transparent ${Math.round(clip)}px)` : '');
}
// Где на телефоне стоит плоский экран профилей (#stage-screen): поля 16 px, сверху шапка + 12, снизу текст главы, 4 : 3.
// Те же числа берёт поза прибора K.profiles в init3D.
function flatRect() {
  const top = nav.getBoundingClientRect().bottom + 12, boxH = svhPx - nat.profiles - top - 16;
  const w = Math.min(innerWidth - 32, boxH * 4 / 3), h = w * 3 / 4;
  const x0 = (innerWidth - w) / 2, y0 = top + (boxH - h) / 2;
  return { x0, x1: x0 + w, y0, y1: y0 + h };
}
// не чаще кадра: событий прокрутки на телефоне бывает больше, чем кадров
let bandRaf = 0;
addEventListener('scroll', () => {
  if (bandRaf || !mobile()) return;
  bandRaf = requestAnimationFrame(() => { bandRaf = 0; bandBg(); });
}, { passive: true });
layoutStage();
let rebuild3D = () => {};   // init3D подменяет: позы прибора зависят от высот текста
document.fonts?.ready.then(() => { layoutStage(); ScrollTrigger.refresh(); rebuild3D(); });

mountBunny($('#bunny'), { reduced, trigger: $('.hero__bunny') });
mountHighFive($('#highfive'), { reduced });

// Аватар «догружается» из 1-битной картинки в фото, когда карточка впервые видна
const seen = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('is-seen'); seen.unobserve(e.target); }
}), { threshold: 0.6 });
$$('.person__avatar').forEach((el) => seen.observe(el));

// Плавная прокрутка колесом: Lenis ведёт страницу по инерции и тикает вместе с GSAP,
// поэтому ScrollTrigger и 3D получают одну и ту же позицию в одном кадре. На тачскринах
// остаётся родная прокрутка — там Lenis даже не качается; с prefers-reduced-motion не включается.
// Пока он грузится, прокрутка родная, а glide() и меню обходятся без него.
// Якоря останавливаются под плавающей навигацией.
let lenis = null;   // якоря ведёт обработчик ниже, а не Lenis
if (!reduced && matchMedia('(pointer: fine)').matches) {
  Promise.all([import('lenis'), import('lenis/dist/lenis.css')]).then(([{ default: Lenis }]) => {
    lenis = new Lenis({ lerp: 0.085 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  });
}

// ── Переключатель языка ────────────────────────────
// Выбор запоминается (его читает скрипт автоопределения в <head> корня), а в другую версию
// переходим на ту же главу, что сейчас на экране.
$$('.nav__lang').forEach((a) => a.addEventListener('click', (e) => {
  const to = a.getAttribute('hreflang');
  try { localStorage.setItem(LANG_KEY, to); } catch {}
  const mid = innerHeight / 2;
  const sec = $$('main section[id]').filter((s) => s.getBoundingClientRect().top <= mid).pop();
  if (sec && scrollY > 40) { e.preventDefault(); location.href = `${a.getAttribute('href')}#${sec.id}`; }
}));

// ── Меню на телефоне ───────────────────────────────
mountMenu({
  button: $('.nav__menu'), panel: $('#menu'), closeLabel: pick({ ru: 'Закрыть меню', en: 'Close menu' }),
  onToggle: (open) => { if (open) lenis?.stop(); else lenis?.start(); },
});

// ── Список профилей ────────────────────────────────
// Строка — кнопка, прокручивает к своему профилю. На телефоне видна только активная строка и стрелки.
const plist = $('#plist');
plist.innerHTML = PROFILES.map((p, i) => `
  <li data-i="${i}">
    <button type="button">
      <img class="pixel" src="/brand/icons/${p.id}.svg" width="16" height="16" alt="">
      <span class="t">${pick(p.name)}</span>
      <span class="n" translate="no">${p.id}</span>
      <span class="d">${pick(p.desc)}</span>
    </button>
  </li>`).join('');
const pItems = $$('li', plist);
const pcur = $('#pcur');
let activeProfile = -1;
let onProfile = () => {};                       // экран прибора подписывается, когда готов 3D
function setActiveProfile(i) {
  if (i === activeProfile) return;
  activeProfile = i;
  pItems.forEach((li, k) => (k === i ? li.setAttribute('aria-current', 'true') : li.removeAttribute('aria-current')));
  pcur.textContent = String(i + 1).padStart(2, '0');
  $$('.pmeta__bar i').forEach((t, k) => t.classList.toggle('is-on', k <= i));
  // на краях списка стрелка не перескакивает на другой конец, а выключается
  $$('.pmeta__step').forEach((b) => { b.disabled = (b.dataset.step < 0 && i === 0) || (b.dataset.step > 0 && i === PROFILES.length - 1); });
  onProfile(i);
}
setActiveProfile(0);

// Прокрутка страницы, где профиль i стоит посередине своего участка
// (тот же участок, по которому считается активный профиль, см. триггер экрана в init3D).
function profileY(i) {
  const sec = $('#profiles');
  const top = sec.getBoundingClientRect().top + scrollY;
  const card = mobile() ? $('.sticky .wrap', sec).offsetHeight : 0;
  const start = top - (mobile() ? stageH : 0);
  const range = mobile() ? sec.offsetHeight - card : sec.offsetHeight - innerHeight;
  return start + range * ((i + 0.5) / PROFILES.length);
}
// Прокрутка по клику (якорь, профиль): привязка к профилям на время полёта выключена,
// иначе браузер ловил бы каждый шаг анимации на ближайшем профиле.
let gliding = false;
function glide(y, duration) {
  if (!lenis) {
    // без Lenis (телефон): привязку к профилям снимаем и на мгновенный прыжок, иначе браузер
    // ставит страницу на ближайшую точку привязки — все якоря дальше «Корпуса» вели бы в «Корпус»
    gliding = true; syncSnap();
    scrollTo({ top: y });
    requestAnimationFrame(() => { gliding = false; syncSnap(); });
    return;
  }
  gliding = true; syncSnap();
  lenis.scrollTo(y, { duration, onComplete: () => { gliding = false; syncSnap(); } });
}
function scrollToProfile(i) { glide(profileY(i), 1.4); }

// ── Телефон: профили по одному за жест ─────────────
// У каждого профиля своя точка привязки со scroll-snap-stop: always: браузер не пролетает через неё,
// как бы сильно ни мотнули, но прокрутка остаётся родной, с инерцией. Привязка включена от верха страницы
// до карточки «Корпуса»: в hero две остановки (самый верх и лид целиком), дальше профили, последняя — «Корпус».
// Дойдя до «Корпуса», страница снова листается свободно. С верха включена сразу: если включать её на входе
// в главу, жест, начатый без привязки, пролетает через профили.
const snapMarks = Object.assign(document.createElement('div'), { className: 'psnap' });
snapMarks.setAttribute('aria-hidden', 'true');
$('#profiles').append(snapMarks);
let snapZone = null;
function layoutSnap() {
  snapMarks.replaceChildren();
  snapZone = null; snapYs = [];
  if (!mobile()) { syncSnap(); return; }
  const secTop = $('#profiles').getBoundingClientRect().top + scrollY;
  const lead = $('.hero .actions');   // нижний блок hero
  const leadBottom = lead.getBoundingClientRect().bottom - (gsap.getProperty(lead, 'y') || 0) + scrollY;
  const heroEnd = Math.max(0, Math.round(leadBottom + 24 - innerHeight));
  const deviceAt = Math.round($('#device').getBoundingClientRect().top + scrollY - stageH + 2);   // как у якоря «Корпус»
  const hero = heroEnd > 40 ? [0, heroEnd] : [0];
  snapYs = [...hero, ...PROFILES.map((_, i) => Math.round(profileY(i))), deviceAt];
  for (const y of snapYs) {
    const m = document.createElement('i');
    m.style.top = `${y - secTop}px`;
    snapMarks.append(m);
  }
  snapZone = deviceAt;
  syncSnap();
}
function syncSnap() {
  const on = !!snapZone && !gliding && scrollY < snapZone - 1;
  document.documentElement.classList.toggle('snap', on);
}
addEventListener('scroll', syncSnap, { passive: true });
// въехали в главу длинным рывком снизу: привязка включилась посреди инерции, и браузер мог встать между
// профилями — доводим до ближайшего
let snapYs = [];
addEventListener('scrollend', () => {
  if (!document.documentElement.classList.contains('snap') || !snapYs.length) return;
  const near = snapYs.reduce((a, y) => (Math.abs(y - scrollY) < Math.abs(a - scrollY) ? y : a));
  if (Math.abs(near - scrollY) > 2) scrollTo({ top: near, behavior: reduced ? 'auto' : 'smooth' });
});
ScrollTrigger.addEventListener('refresh', layoutSnap);
// Страховка на нижней границе: на «Корпусе» привязка выключена, и когда жест вверх её включает,
// браузер может тут же притянуть страницу обратно к «Корпусу». Если жест вверх начался здесь,
// а страница так и осталась на месте, сами доводим до последнего профиля.
let touchY0 = 0, scrollY0 = 0;
addEventListener('touchstart', (e) => { touchY0 = e.touches[0].clientY; scrollY0 = scrollY; }, { passive: true });
addEventListener('touchend', (e) => {
  if (!snapZone || Math.abs(scrollY0 - snapZone) > 2) return;
  if ((e.changedTouches[0]?.clientY ?? touchY0) - touchY0 < 12) return;   // палец шёл вниз = страница вверх
  setTimeout(() => { if (scrollY >= snapZone - 2) glide(snapYs[snapYs.length - 2], 0.8); }, 180);
}, { passive: true });
pItems.forEach((li, i) => li.querySelector('button').addEventListener('click', () => scrollToProfile(i)));
$$('.pmeta__step').forEach((b) => b.addEventListener('click', () => {
  scrollToProfile(Math.max(0, Math.min(PROFILES.length - 1, activeProfile + Number(b.dataset.step))));
}));

// Все якоря страницы. «Профили» открываются на первом профиле; главы-истории — там, где их карточка
// встаёт под полосу прибора (на телефоне) и прибор в начальном ракурсе главы; остальное — под шапкой.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  const id = a?.getAttribute('href').slice(1);
  const sec = id && document.getElementById(id);
  if (!sec) return;
  e.preventDefault();
  if (id === 'profiles') { scrollToProfile(0); history.replaceState(null, '', '#profiles'); return; }
  const top = sec.getBoundingClientRect().top + scrollY;
  const y = id === 'top' || id === 'main' ? 0
    : sec.closest('#story') ? top - (mobile() ? stageH : 0) + 2
    : top - nav.getBoundingClientRect().bottom - 12;
  glide(y, 1.2);
  history.replaceState(null, '', id === 'top' ? location.pathname : `#${id}`);
  sec.focus({ preventScroll: true });
});

// ── Навигация темнеет над тёмными главами ──────────
// onToggle может сработать прямо при создании (перезагрузка посреди страницы), поэтому массив объявлен заранее
// На телефоне навигация лежит на полосе прибора, поэтому темнеет вместе с ней: по нижнему краю полосы.
// Главы истории — по нижнему краю полосы, блоки после неё — по самой шапке.
// край главы, при котором быстрый край шторки (vh·(край − полоса)/(vh − полоса) в bandBg) доходит до низа шапки
const navEdge = () => Math.round(stageH + nav.getBoundingClientRect().bottom * (innerHeight - stageH) / innerHeight);
const darkST = [];
$$('[data-theme="dark"]').forEach((el) => darkST.push(ScrollTrigger.create({
  trigger: el,
  // телефон: шапка темнеет, когда край «шторки» (bandBg) проходит её низ, а не когда глава доходит до полосы
  start: () => (mobile() && el.closest('#story') ? `top ${navEdge()}px` : 'top 40px'),
  end: () => (mobile() && el.closest('#story') ? `bottom ${navEdge()}px` : 'bottom 40px'),
  onToggle: syncDark,
  onRefresh: syncDark,
})));
function syncDark() {
  const dark = darkST.some((t) => t.isActive);
  nav.classList.toggle('is-dark', dark);
  $('.stage').classList.toggle('is-dark', dark);
}

// ── Появление текста ───────────────────────────────
// Одно движение на весь сайт: подъём на 24px, 1 с, expo.out, шаг 70 мс.
// Стартовое состояние задано в CSS (.js .reveal).
const SHOW = { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.07, overwrite: true };
const HIDE = { opacity: 0, y: 24, duration: 0.4, ease: 'power2.in', stagger: 0, overwrite: true };
// Обычные блоки: пачками по мере появления, один раз.
const revealIn = (root) => {
  const els = $$('.reveal', root);
  if (reduced || !els.length) return;
  ScrollTrigger.batch(els, { start: 'top 88%', once: true, onEnter: (batch) => gsap.to(batch, SHOW) });
};
// раскладка телефона, как в CSS и isPhoneLayout
const PHONE_MQ = '(max-width: 860px) and ((orientation: portrait) or (min-height: 501px))';
// Телефон: карточка главы гаснет вместе с прокруткой — начинает на 60 px раньше, чем тронется с места,
// и пропадает, поднявшись на 40 px, до того как зайдёт под прибор. Назад проявляется так же, без рывка по времени.
// Последняя глава уезжает вместе со страницей, её текст не гаснет. Прозрачность, не движение: и при reduced-motion.
gsap.matchMedia().add(PHONE_MQ, () => {
  for (const sec of $$('#story .scene:not(.hero):not(#blueprint)')) {
    gsap.fromTo($('.sticky .wrap', sec), { opacity: 1 }, {
      opacity: 0, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: sec, start: () => `bottom ${innerHeight + 60}px`, end: () => `bottom ${innerHeight - 40}px`, scrub: true },
    });
  }
});
if (!reduced) {
  gsap.to('.hero .reveal', { ...SHOW, delay: 0.15 });
  // телефон: текст hero гаснет в первые 120 px прокрутки — до того, как к нему подойдут прибор и тёмная шторка
  gsap.matchMedia().add(PHONE_MQ, () => {
    gsap.to('.hero__inner', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=120', scrub: true } });
  });
  // Главы-истории: текст появляется при входе и прячется, если вернуться выше.
  // Уход на телефоне ведёт прокрутка (PHONE_MQ выше), не таймер: тот двигал заголовок вниз на 24 px, и он прыгал.
  $$('.scene:not(.hero)').forEach((sec) => {
    const els = $$('.reveal', sec);
    ScrollTrigger.create({
      trigger: sec, start: () => (mobile() ? 'top 85%' : 'top 60%'),
      onEnter: () => gsap.to(els, SHOW),
      onLeaveBack: () => gsap.to(els, HIDE),
    });
  });
  $$('.block').forEach(revealIn);

  // Подсказка «листайте» гаснет с первым движением
  gsap.to('.scrollhint', { opacity: 0, y: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=160', scrub: true } });
}

// Глава «Из чего сделан» уже в HTML (собрана при сборке), оживить нужно только чип
mountChipFlights();

// Бегущий кролик в подвале: бежит без конца. Уходит хвостом за правый край, следующий выбегает слева.
// Шаг — целые 2 px: спрайт нарисован в 2×. Пока подвал не виден, анимация стоит.
if (!reduced) {
  const bunny = $('.runner__bunny'), runner = $('.runner');
  const SPEED = 110; // px/с: под цикл бега 400 мс
  let run, visible = false, lastW = 0;
  const start = () => {
    const w = runner.clientWidth;
    if (w === lastW) return;           // на телефоне resize приходит и от панели адреса при прокрутке
    lastW = w;
    run?.kill();
    run = gsap.fromTo(bunny, { x: -60 }, {
      x: w, duration: (w + 60) / SPEED, ease: 'none', repeat: -1, paused: !visible,
      modifiers: { x: (x) => `${Math.round(parseFloat(x) / 2) * 2}px` },
    });
  };
  start();
  addEventListener('resize', start);
  ScrollTrigger.create({ trigger: '.footer', start: 'top bottom', onToggle: (self) => { visible = self.isActive; visible ? run?.play() : run?.pause(); } });
}

// ── 3D ─────────────────────────────────────────────
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
function fallback(err) {
  if (err) console.error(err);
  document.documentElement.classList.add('no-gl');
  $('.stage').classList.add('is-off');
  const img = $('.hero__fallback');
  img.hidden = false; img.style.opacity = 1;
  ScrollTrigger.refresh();
}

if (!webglOK()) fallback();
else init3D().catch(fallback);

async function init3D() {
  const canvas = $('#gl');
  const stage = $('.stage');
  // three.js (самый тяжёлый чанк) качается сразу, а не после экрана
  const sceneModule = import('./scene.js');
  sceneModule.catch(() => {});   // ошибку отдаст Promise.all ниже, здесь только без «unhandled rejection»
  const { createScreen } = await import('./screen.js');
  // экран 640×480 рисуется в 2× (1280×960); на телефонах хватает 1.5×
  const screen = createScreen({ scale: mobile() ? 1.5 : 2, lang: LANG }); // стартовый масштаб, дальше подгоняется
  // сцена и шрифты для экрана грузятся параллельно
  const [{ createScene }] = await Promise.all([
    sceneModule,
    // образец на языке экрана: на /en/ кириллический набор шрифта не нужен и не качается
    document.fonts.load('700 10px "JetBrains Mono"', LANG === 'en' ? 'WRITING abc' : 'ЗАПИСЬ abc').catch(() => {}),
    document.fonts.load('500 10px "JetBrains Mono"', LANG === 'en' ? 'BREAK abc' : 'ОБРЫВ abc').catch(() => {}),
  ]);
  // без покачивания: неподвижный прибор даёт кадру «успокоиться», и GPU простаивает
  const sc = await createScene(canvas, screen, { mobile: mobile(), bob: false, lang: LANG });
  const { state, extra } = sc;
  onProfile = (i) => { if (screen.mode === 'profile') screen.setMode('profile', i); };

  let phone = mobile();          // раскладка, под которую собрана временная шкала
  const frameH = () => canvas.clientHeight;

  // Ключевые положения прибора. x, y — доли половины кадра, h — доля высоты кадра.
  // Широкий экран: свободное место справа от колонки текста. Прибор ставится по его центру
  // и уменьшается, если не помещается: так он не заходит на текст ни на какой ширине.
  // ratio — ширина силуэта к высоте в этом ракурсе, reserve — место под подписи, px.
  const slot = (sel, ratio, hMax, reserve = 0) => {
    const right = Math.max(0, ...$$(`${sel} .col > *`).map((e) => e.getBoundingClientRect().right));
    // подписи стоят по обе стороны прибора: половину запаса отдаём зазору от текста, половину — правому краю
    const left = right + 48 + reserve / 2, free = innerWidth - left - 24 - reserve / 2;
    const x = ((left + free / 2) / innerWidth) * 2 - 1;
    // окно ещё без размера (фоновая вкладка, панель только открылась): 0/0 дал бы NaN, и прибор пропал бы насовсем
    const h = Math.max(0.36, Math.min(hMax, (free * 0.92) / (Math.max(1, innerHeight) * ratio) || hMax));
    return { x: Number.isFinite(x) ? x : 0.4, h };
  };
  // Телефон: холст — непрозрачная полоса сверху (CSS --stage-h), текст идёт под ней.
  // Прибор вписывается в полосу между навигацией и её нижним краем, с местом под подсказку.
  // key — глава: прибор до верха её текста; без key (hero) — до низа непрозрачной полосы
  // запас снизу — под подпись детали или подсказку; в hero их нет, прибор встаёт почти вплотную к заголовку
  const band = (key) => ({ top: nav.getBoundingClientRect().bottom, bottom: (key ? svhPx - nat[key] : stageH) - (key === 'hero' ? 8 : 40), frameH: frameH(), pad: 16 });
  // Телефон на боку: кадр низкий, прибор вписывается по высоте между шапкой и низом экрана,
  // а не стоит на фиксированной высоте (иначе верх уходит под навигацию)
  const fitLow = (pose, silhouette) => (isLandscapePhone(innerWidth, innerHeight)
    ? { ...pose, ...slotY({ top: nav.getBoundingClientRect().bottom, bottom: frameH(), frameH: frameH(), pad: 12, silhouette, hMax: pose.h }) }
    : pose);
  const K = {
    hero: () => phone
      ? { x: 0, ...slotY({ ...band('hero'), silhouette: 1.1 }), rx: 0.12, ry: -0.45, rz: 0.04, explode: 0, open: 0, lines: 0 }
      : fitLow({ ...slot('#top', 0.62, 0.7), y: -0.06, rx: 0.12, ry: -0.5, rz: 0.05, explode: 0, open: 0, lines: 0 }, 1.1),   // ниже шапки
    profiles: () => {
      // на телефоне крупно экран прибора: во всю ширину, по центру полосы; корпус уходит за её нижний край
      if (phone) {
        const b = band('profiles');
        // Экран в 3D встаёт ровно туда, где его сменит плоский холст (#stage-screen: поля 16 px,
        // сверху шапка + 12, 4 : 3) — тогда смена незаметна. Корпус шире экрана и уходит за края кадра.
        const padTop = b.top + 12, boxH = svhPx - nat.profiles - padTop - 16;
        const wFlat = Math.min(innerWidth - 32, boxH * 4 / 3);
        const wScreen = wFlat * 70 / 68;                    // модуль 70 мм, видимая часть экрана 68 мм
        const dev = wScreen / 70 * 150;                                                 // высота корпуса, px
        const cy = padTop + boxH / 2 + (116 - 75) / 150 * dev;                          // центр корпуса, px
        return { x: 0, y: (b.frameH / 2 - cy) / (b.frameH / 2), h: dev / b.frameH, rx: 0, ry: 0, rz: 0, explode: 0, open: 0, lines: 0 };
      }
      const s = slot('#profiles', 0.62, 1.35);   // силуэт в этом ракурсе ≈ 0,62 высоты
      return { ...s, y: 0.16 - 0.565 * s.h, rx: 0.02, ry: -0.08, rz: 0, explode: 0, open: 0, lines: 0 };
    },
    devA: () => phone
      ? { x: 0, ...slotY({ ...band('device'), silhouette: 1.02 }), rx: 0.2, ry: -0.6, rz: 0, explode: 0, open: 0, lines: 0 }
      : fitLow({ ...slot('#device', 0.8, 0.62, 440), y: -0.06, rx: 0.2, ry: -0.6, rz: 0, explode: 0, open: 0, lines: 0 }, 1.02),
    // разлёт по глубине делает силуэт больше: на телефоне ужимаем, чтобы не залезть под карточку
    devB: () => ({ ...K.devA(), explode: 1, ...(phone ? { h: K.devA().h * 0.76 } : {}) }),
    devC: () => ({ ...K.devA(), rx: 0.3, ry: -2.5, explode: 1, open: 1, ...(phone ? { h: K.devA().h * 0.76 } : {}) }),
    bp: () => phone
      // размерные линии выступают на 12 мм снизу и 10 мм справа: оставляем им место
      ? { x: -0.1, ...slotY({ ...band('blueprint'), silhouette: 1.3 }), rx: 0.18, ry: -0.42, rz: 0, explode: 0, open: 0, lines: 1 }
      : fitLow({ ...slot('#blueprint', 0.65, 0.6, 300), y: -0.06, rx: 0.18, ry: -0.42, rz: 0, explode: 0, open: 0, lines: 1 }, 1.3),
  };
  // Прокрутка двигает цель, а прибор догоняет её затуханием в loop(): рывки колеса мыши
  // сглаживаются, а на любой частоте кадров движение одинаковое.
  const target = { ...K.hero() };
  Object.assign(state, target);
  if (import.meta.env.DEV) window.__fabbit = { sc, target, screen, K, ST: ScrollTrigger, tl: () => tl };   // отладка ракурсов из консоли

  let tl;
  function build() {
    tl?.scrollTrigger?.kill(); tl?.kill();
    const story = $('#story');
    const vh = innerHeight;
    const off = (sel) => $(sel).offsetTop - story.offsetTop;
    const h = (sel) => $(sel).offsetHeight;
    const P = off('#profiles'), D = off('#device'), B = off('#blueprint');
    const Bend = B + h('#blueprint');

    tl = gsap.timeline({
      defaults: { ease: 'sine.inOut', immediateRender: false },
      scrollTrigger: { trigger: story, start: 'top top', end: `+=${Bend}`, scrub: true },
    });
    const seg = (from, to, a, b, ease) => tl.fromTo(target, { ...K[from]() }, { ...K[to](), duration: b - a, ease }, a);
    // Глава «встаёт» на место: на широком экране — когда её верх доходит до верха экрана,
    // на телефоне — когда её карточка доезжает до нижнего края полосы прибора (раньше на высоту полосы).
    const at = phone ? stageH : 0;   // верх карточки главы на телефоне
    // телефон: прибор приезжает к экрану чуть раньше конца подхода — плоский экран проявляется поверх уже
    // неподвижного 3D-экрана, без двоения
    seg('hero', 'profiles', P - vh, P - at - (phone ? 80 : 0));
    seg('profiles', 'devA', D - vh, D - at);
    // Ход разборки. Широкий экран: пока глава липнет — разлёт, затем прибор разворачивается спиной.
    // Телефон: всё, пока карточка стоит под полосой и до начала чертежа; разлёт и разворот идут быстрее,
    // а остаток прибор стоит спиной, и рядом по очереди подписываются главные детали (phoneSpan).
    const Dr = phone ? Math.min(h('#device') - $('#device .sticky .wrap').offsetHeight, B - vh - (D - at)) : h('#device') - vh;
    const [b1, c0, c1] = phone ? [0.14, 0.18, 0.38] : [0.35, 0.42, 0.88];
    seg('devA', 'devB', D - at, D - at + Dr * b1, 'power3.out');
    seg('devB', 'devC', D - at + Dr * c0, D - at + Dr * c1);
    const storyTop = story.getBoundingClientRect().top + scrollY;
    phoneSpan = [storyTop + D - at + Dr * (c1 + 0.03), storyTop + D - at + Dr - 80];   // гаснут раньше текста главы
    seg('devC', 'bp', B - vh, B - at);
    // дальше чертёж стоит: из кадра его уносит сама полоса прибора вместе с главой (.stage-track в CSS)
    tl.to({}, { duration: 0 }, Bend);
    // до первого сегмента состояние героя
    Object.assign(target, K.hero());
    tl.scrollTrigger.update?.();
    tl.progress(tl.scrollTrigger.progress);
  }

  // Телефон, профили: вместо прибора в полосе показывается сам экран — крупно, без корпуса.
  // Это тот же холст, что текстура экрана в 3D; пока он на виду, 3D не рисуется.
  const flat = $('#stage-screen');
  let flatOn = false, flatAt = -1e9, flatAttached = false;
  function attachFlat() {
    if (flatAttached) return;
    flatAttached = true;
    flat.append(screen.canvas);
    const w = flat.clientWidth - 32;
    if (screen.setScale(Math.min(2.5, Math.max(1, Math.ceil(w * devicePixelRatio / 640 * 4) / 4)))) sc.screenResized();
  }
  function showFlatScreen(on) {
    if (on === flatOn) return;
    flatOn = on; flatAt = performance.now();
    if (on) attachFlat();
    flat.classList.toggle('is-on', on);
  }
  // Подход к профилям на телефоне: пока тёмная глава поднимается к полосе, фон полосы темнеет вместе
  // с прокруткой, а плоский экран проявляется поверх 3D. Раньше полоса оставалась белой до последнего,
  // и под экраном прибора мелькала белая полоса корпуса, а затем экран включался разом.
  function setApproach(p) {
    const q = phone ? Math.max(0, Math.min(1, (p - 0.93) / 0.07)) : 0;   // в самом конце, когда 3D-экран уже на месте плоского
    if (q > 0) attachFlat();
    else if (!flatOn) flatAttached = false;   // экран снова живёт только в 3D: пусть его разрешение подгоняет loop
    flat.style.setProperty('--in', q);
    flat.style.visibility = q > 0 ? 'visible' : '';
  }
  ScrollTrigger.create({
    trigger: '#profiles', start: 'top bottom', end: () => `top ${stageH}px`,
    onUpdate: (self) => setApproach(self.progress),
    onLeave: () => setApproach(1), onLeaveBack: () => setApproach(0),
  });

  // Экран: загрузка → меню → профиль по прокрутке. Индекс берётся из прогресса триггера,
  // без чтения раскладки на каждом шаге прокрутки.
  ScrollTrigger.create({
    // на телефоне — пока карточка стоит под полосой прибора
    trigger: '#profiles',
    start: () => (phone ? `top ${stageH}px` : 'top top'),
    end: () => (phone ? `bottom ${stageH + $('#profiles .sticky .wrap').offsetHeight}px` : 'bottom bottom'),
    onUpdate: (self) => setActiveProfile(Math.max(0, Math.min(PROFILES.length - 1, Math.floor(self.progress * PROFILES.length)))),
    onToggle: (self) => {
      if (self.isActive) screen.setMode('profile', Math.max(0, activeProfile));
      showFlatScreen(phone && self.isActive);
    },
    onLeaveBack: () => { if (screen.mode !== 'boot') screen.setMode('menu'); },
    // ушли из профилей вниз: проявление от подхода (--in: 1) снимаем, иначе плоский экран
    // так и висел бы поверх 3D на «Корпусе» и «Чертеже»
    onLeave: () => { flat.style.removeProperty('--in'); flat.style.visibility = ''; },
  });

  // Мышь: лёгкий параллакс. Касание не в счёт: иначе прибор остаётся наклонённым к месту тапа.
  const mouse = { x: 0, y: 0 };
  if (!reduced) addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX / innerWidth * 2 - 1;
    mouse.y = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });

  // Интро
  if (!reduced) {
    Object.assign(extra, { ry: -1.2, rx: 0.25, y: -0.2, s: 0.9 });
    gsap.to(extra, { ry: 0, rx: 0, y: 0, s: 1, duration: 2.2, ease: 'expo.out', delay: 0.1 });
    gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' });
  }
  // рендер-заставка больше не нужна: её сменяет живой прибор
  gsap.to('.hero__fallback', { opacity: 0, duration: reduced ? 0 : 0.6, onComplete: () => { $('.hero__fallback').hidden = true; } });

  // 2D-слой
  const svg = $('#overlay');
  const calloutsEl = $('#callouts');
  const labels = sc.overlayData().callouts.map((c) => {
    const el = document.createElement('div');
    el.className = 'callout';
    el.innerHTML = `<b>${c.title}</b>${c.sub ? `<span>${c.sub}</span>` : ''}`;
    calloutsEl.appendChild(el);
    return el;
  });
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); svg.appendChild(e); return e; };
  const leaders = labels.map(() => mk('polyline', { fill: 'none', stroke: '#0A0A0A', 'stroke-width': 1 }));
  const dots = labels.map(() => mk('rect', { width: 5, height: 5, fill: '#0A0A0A' }));
  const dimG = sc.overlayData().dims.map(() => ({
    line: mk('line', { stroke: '#0A0A0A', 'stroke-width': 1 }),
    t1: mk('line', { stroke: '#0A0A0A', 'stroke-width': 1 }),
    t2: mk('line', { stroke: '#0A0A0A', 'stroke-width': 1 }),
    bg: mk('rect', { fill: '#FFFFFF', height: 18 }),
    text: mk('text', { 'font-family': 'JetBrains Mono, monospace', 'font-size': 12, 'font-weight': 500, fill: '#0A0A0A', 'text-anchor': 'middle', 'dominant-baseline': 'central' }),
  }));
  dimG.forEach((d, i) => { d.text.textContent = `${sc.overlayData().dims[i].label} ${pick({ ru: 'мм', en: 'mm' })}`; });
  // Ширины подписей не меняются: меряем один раз (и заново после смены раскладки),
  // а не на каждом кадре — иначе браузер пересчитывает раскладку по разу на подпись.
  let labelW = [], labelH = [], dimW = [], textRight = 0;
  const measure = () => {
    labelW = labels.map((el) => el.offsetWidth);
    labelH = labels.map((el) => el.offsetHeight);
    dimW = dimG.map((g) => g.text.getComputedTextLength?.() || 40);
    // правый край колонки текста: подпись, которая залезла бы на текст, не показываем
    textRight = phone ? 0 : Math.max(0, ...$$('#device .col > *').map((e) => e.getBoundingClientRect().right));
  };
  // Телефон: рядом с прибором места хватает на одну подпись. Главные детали показываются по очереди,
  // по прокрутке главы (phoneSpan считается в build()), в порядке, в каком они разворачиваются к камере.
  // разъёмы нижнего торца не в списке: спиной к камере их точка ложится на соседние детали
  // по группам деталей, а не по подписи: подписи зависят от языка
  const PHONE_CALLOUTS = ['I9', 'Mezz', 'SMA', 'Battery']
    .map((g) => sc.overlayData().callouts.findIndex((c) => c.group === g && !c.bp)).filter((i) => i >= 0);
  let phoneSpan = [0, 1];
  const placed = [];   // подписи этого кадра: [верх, низ] по сторонам, чтобы соседние не наезжали

  function drawOverlay() {
    const calloutsOn = Math.max(0, Math.min(1, (state.explode - 0.55) / 0.35)) * (1 - state.lines);
    let pick = -1;
    if (phone) {
      const q = (scrollY - phoneSpan[0]) / Math.max(1, phoneSpan[1] - phoneSpan[0]);
      if (q >= 0 && q <= 1) pick = PHONE_CALLOUTS[Math.min(PHONE_CALLOUTS.length - 1, Math.floor(q * PHONE_CALLOUTS.length))];
    }
    const dimOn = Math.max(0, (state.lines - 0.6) / 0.4);
    // подписи кнопок на чертеже появляются вместе с размерами
    const bpOn = phone ? 0 : dimOn;
    if (calloutsOn <= 0.001 && dimOn <= 0.001) {
      svg.style.opacity = 0; calloutsEl.style.opacity = 0; return;
    }
    if (!labelW.length) measure();
    const data = sc.overlayData();
    svg.style.opacity = 1; calloutsEl.style.opacity = 1;
    const vw = stage.clientWidth;
    // подписи держатся в 16 px от края окна; прибор для этого сдвинут влево запасом reserve в slot()
    const gridRight = vw - 16;
    const gap = phone ? 12 : innerWidth < 1280 ? 24 : 40;
    placed.length = 0;
    // сверху вниз: так нижняя из двух близких подписей сдвигается вниз, а не прыгает через соседку
    const order = data.callouts.map((c, i) => i).sort((a, b) => data.callouts[a][1] - data.callouts[b][1]);
    for (const i of order) {
      const c = data.callouts[i];
      const el = labels[i];
      let vis = (c.bp ? bpOn : calloutsOn) * Math.max(0, Math.min(1, (c.facing - 0.05) / 0.25));
      if (phone && i !== pick) vis = 0;
      const left = c[0] < data.center[0];
      const lx = left ? Math.min(c[0], data.box[0]) - gap : Math.max(c[0], data.box[1]) + gap;
      const w = labelW[i], h = labelH[i];
      const want = left ? lx - w - 6 : lx + 6;
      if (phone) {
        // телефон: по бокам от прибора места нет — подпись встаёт по центру в полосу под прибором,
        // выноска опускается к ней от детали отвесно
        el.style.opacity = vis; leaders[i].style.opacity = vis; dots[i].style.opacity = vis;
        if (vis <= 0.001) continue;
        const px = Math.max(16 + w / 2, Math.min(vw - 16 - w / 2, c[0])), py = svhPx - nat.device + 8 - h;
        el.classList.remove('is-left');
        el.style.transform = `translate(${(px - w / 2) | 0}px, ${py | 0}px)`;
        leaders[i].setAttribute('points', `${c[0]},${c[1]} ${c[0]},${py - 6} ${px},${py - 6}`);
        dots[i].setAttribute('x', c[0] - 2.5); dots[i].setAttribute('y', c[1] - 2.5);
        continue;
      }
      const tx = Math.max(6, Math.min(gridRight - w, want));
      // узкий экран: подпись легла бы на колонку текста или, упёршись в край кадра, на сам прибор
      // не обрываем разом, а гасим на 40 px наезда: подпись у границы не мигает при прокрутке
      const overText = textRight + 16 - tx;
      const overDevice = tx === want ? 0 : left ? tx + w - (data.box[0] - 8) : data.box[1] + 8 - tx;
      vis *= Math.max(0, Math.min(1, 1 - Math.max(overText, overDevice) / 40));
      el.style.opacity = vis;
      leaders[i].style.opacity = vis; dots[i].style.opacity = vis;
      if (vis <= 0.001) continue;
      // соседняя подпись на той же стороне уже стоит здесь — опускаемся под неё, выноска идёт наклонно
      let ty = c[1] - 8;
      for (const p of placed) if (p.left === left && ty < p.bottom + 4 && ty + h > p.top) ty = p.bottom + 4;
      placed.push({ left, top: ty, bottom: ty + h });
      el.classList.toggle('is-left', left);
      el.style.transform = `translate(${tx | 0}px, ${ty | 0}px)`;
      // выноска доходит до подписи, даже если её прижало к краю кадра
      leaders[i].setAttribute('points', `${c[0]},${c[1]} ${left ? tx + w + 6 : tx - 6},${ty + 8}`);
      dots[i].setAttribute('x', c[0] - 2.5); dots[i].setAttribute('y', c[1] - 2.5);
    }
    data.dims.forEach((d, i) => {
      const g = dimG[i];
      for (const k in g) g[k].style.opacity = dimOn;
      const [ax, ay] = d.a, [bx, by] = d.b;
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * 6, ny = dx / len * 6;
      g.line.setAttribute('x1', ax); g.line.setAttribute('y1', ay); g.line.setAttribute('x2', bx); g.line.setAttribute('y2', by);
      g.t1.setAttribute('x1', ax - nx); g.t1.setAttribute('y1', ay - ny); g.t1.setAttribute('x2', ax + nx); g.t1.setAttribute('y2', ay + ny);
      g.t2.setAttribute('x1', bx - nx); g.t2.setAttribute('y1', by - ny); g.t2.setAttribute('x2', bx + nx); g.t2.setAttribute('y2', by + ny);
      const tw = dimW[i];
      // подпись не уходит за край кадра
      // подпись отодвинута от прибора наружу, по нормали к размерной линии: не ложится на корпус
      const cx0 = (ax + bx) / 2, cy0 = (ay + by) / 2, out = Math.sign((cx0 - data.center[0]) * nx + (cy0 - data.center[1]) * ny) || 1;
      const mx = Math.max(tw / 2 + 8, Math.min(vw - tw / 2 - 8, cx0 + out * nx * 2.5)), my = cy0 + out * ny * 2.5;
      g.text.setAttribute('x', mx); g.text.setAttribute('y', my);
      g.bg.setAttribute('x', mx - tw / 2 - 6); g.bg.setAttribute('y', my - 9); g.bg.setAttribute('width', tw + 12);
    });
  }

  // Рендер только пока история на экране; после неё слой прячется целиком
  let running = true, idleFrames = 0;
  ScrollTrigger.create({
    // слой прячется, когда полоса прибора целиком уехала за верх экрана (на телефоне она кончается над карточкой)
    trigger: '#story', start: 'top bottom', end: () => `bottom ${storyTail}px`,
    onToggle: (self) => setRunning(self.isActive),
    // перезагрузка посреди страницы: onToggle не сработает, состояние берём сразу
    onRefresh: (self) => setRunning(self.isActive),
  });
  function setRunning(on) {
    stage.classList.toggle('is-off', !on);
    if (on === running) return;
    running = on;
    if (running) { idleFrames = 0; requestAnimationFrame(loop); }
  }

  // Поворот пальцем или мышью: горизонтальный жест крутит прибор, после отпускания он плавно возвращается
  // в ракурс главы. Вертикальный жест остаётся прокруткой (touch-action: pan-y в CSS).
  const drag = { ry: 0, active: false, used: false, x0: 0, start: 0 };
  const hint = $('.stage__hint');
  // история уходит с экрана: подсказка гаснет сразу, а не висит одна между главами
  let leaving = false;
  ScrollTrigger.create({
    trigger: '#story', start: () => `bottom ${innerHeight}px`, end: 'max',
    onToggle: (self) => { leaving = self.isActive; },
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    Object.assign(drag, { active: true, x0: e.clientX, start: drag.ry });
    gsap.killTweensOf(drag);
    canvas.setPointerCapture(e.pointerId);
    idleFrames = 0;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag.active) return;
    drag.ry = drag.start + ((e.clientX - drag.x0) / canvas.clientWidth) * Math.PI * 1.6;
    if (Math.abs(e.clientX - drag.x0) > 8) drag.used = true;
    idleFrames = 0;
  });
  const release = () => {
    if (!drag.active) return;
    drag.active = false;
    gsap.to(drag, { ry: 0, duration: 0.6, delay: reduced ? 0 : 0.8, ease: 'power3.inOut' });
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const clock = { t0: performance.now(), lastScreen: 0 };
  function loop(now) {
    if (!running) return;
    const t = (now - clock.t0) / 1000;
    const dt = Math.min(0.1, (now - (clock.prev ?? now)) / 1000);
    clock.prev = now;
    // затухание к цели: постоянная времени ~0.12 с поверх инерции Lenis; без анимаций прибор сразу встаёт на место
    const k = reduced ? 1 : 1 - Math.exp(-dt * 8);
    let moving = 0;
    for (const key in target) {
      // NaN в затухании не уходит никогда: сразу встаём на цель
      if (!Number.isFinite(state[key])) state[key] = Number.isFinite(target[key]) ? target[key] : 0;
      const d = target[key] - state[key]; state[key] += d * k; moving = Math.max(moving, Math.abs(d));
    }
    // мышь плавно
    const km = 1 - Math.exp(-dt * 2.5);
    const dry = mouse.x * 0.18 - (extra.mry || 0), drx = mouse.y * 0.08 - (extra.mrx || 0);
    extra.mry = (extra.mry || 0) + dry * km;
    extra.mrx = (extra.mrx || 0) + drx * km;
    moving = Math.max(moving, Math.abs(dry), Math.abs(drx));
    const baseRy = extra.ry, baseRx = extra.rx;
    extra.ry = baseRy + extra.mry + drag.ry; extra.rx = baseRx + extra.mrx;
    const screenOn = flatOn || sc.screenVisible();
    // Разрешение экрана под размер в кадре с запасом 1.5×: прибор повёрнут и качается,
    // поэтому текстура чуть уменьшается при выборке, а не растягивается — так контуры остаются резкими.
    // Шаг 0.25×, от 1× до 2× (на телефоне до 1.5×): больше глаз не различает, а загрузка в GPU дороже.
    if (screenOn && !flatAttached && now - (clock.lastFit || 0) > 300) {
      clock.lastFit = now;
      const [pw, ph] = sc.screenPixels();
      const need = Math.max(pw / 640, ph / 480) * 1.5;
      const want = Math.min(phone ? 1.5 : 2, Math.max(1, Math.ceil(need * 4) / 4));
      // растём сразу, уменьшаемся только при заметной разнице, чтобы не дёргать текстуру
      if (want > screen.scale || want < screen.scale - 0.5) {
        if (screen.setScale(want)) { sc.screenResized(); clock.lastScreen = -1; }
      }
    }
    // экран перерисовываем и грузим в GPU, только пока его видно
    let screenChanged = false;
    if (screenOn && t - clock.lastScreen > 1 / 30) { screenChanged = screen.draw(t); clock.lastScreen = t; }
    // без покачивания, движения и смены экрана кадр тот же: не рисуем его заново
    const still = moving < 1e-4 && !screenChanged && !sc.bobbing && !gsap.isTweening(extra) && !gsap.isTweening(drag) && !drag.active;
    hint.classList.toggle('is-on', state.lines > 0.8 && !leaving && !drag.used);
    stage.classList.toggle('can-drag', state.lines > 0.8 && !leaving);
    // широкий экран: подсказка под самим прибором, а не посередине страницы
    if (!phone && state.lines > 0.5) hint.style.left = `${sc.overlayData().center[0] | 0}px`;
    else if (phone) hint.style.left = '';
    idleFrames = still ? idleFrames + 1 : 0;
    // телефон, разборка: прибор стоит, а подписи сменяются по прокрутке — кадр нужен и без движения
    if (phone && scrollY !== clock.sy) {
      clock.sy = scrollY;
      if (scrollY > phoneSpan[0] - 60 && scrollY < phoneSpan[1] + 60) idleFrames = 0;
    }
    // экран на полосе закрыл прибор целиком (переход 0,35 с кончился) — 3D не рисуем
    if (now - flatAt < 450) idleFrames = 0;
    if (idleFrames < 3 && !(flatOn && now - flatAt > 450)) {
      sc.render(reduced ? 0 : t, screenChanged);
      drawOverlay();
    }
    extra.ry = baseRy; extra.rx = baseRx;
    requestAnimationFrame(loop);
  }

  // Смена раскладки. На телефоне resize прилетает и при появлении панели адреса:
  // если ширина та же, раскладку не пересобираем, только размер холста.
  let rt, lastW = innerWidth;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      sc.resize();
      idleFrames = 0;
      // раскладка зависит и от высоты (телефон на боку), поэтому пересобираем и при её смене
      if (innerWidth === lastW && mobile() === phone) return;
      lastW = innerWidth;
      phone = mobile();
      layoutStage();
      labelW = [];
      ScrollTrigger.refresh();
      build();
    }, 150);
  });
  ScrollTrigger.refresh();
  build();
  rebuild3D = () => { sc.resize(); build(); };
  requestAnimationFrame(loop);
}

// Чип в карточке ПЛИС (разметка из src/build/ChipFlight.jsx): CSS-анимация идёт, только пока плитка на экране.
export function mountChipFlights(root = document) {
  const els = root.querySelectorAll('[data-flight]');
  if (!els.length || typeof IntersectionObserver === 'undefined') return;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { e.target.dataset.running = String(e.isIntersecting); }));
  els.forEach((el) => io.observe(el));
}

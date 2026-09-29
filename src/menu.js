// Меню разделов на телефоне: кнопка в шапке открывает полноэкранный список.
// Закрывается по Esc, ссылке и той же кнопке в шапке (она становится крестиком); фокус держится внутри, пока меню открыто.

export function mountMenu({ button, panel, onToggle = () => {}, closeLabel = 'Закрыть меню' }) {
  const label = button.getAttribute('aria-label');
  // кнопка в шапке — крестик закрытия — входит в круг фокуса последней: с клавиатуры до неё можно дойти Tab-ом
  const inside = () => [...panel.querySelectorAll('a[href], button:not([disabled])')];
  const focusables = () => [...inside(), button];

  function set(open) {
    if (open === !panel.hidden) return;
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? closeLabel : label);   // иконка сама меняется на крестик в CSS
    document.documentElement.classList.toggle('menu-open', open);
    onToggle(open);
    if (open) inside()[0]?.focus();
    else button.focus();
  }

  button.addEventListener('click', () => set(panel.hidden));
  panel.addEventListener('click', (e) => {
    if (e.target.closest('a[href], .menu__close')) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (panel.hidden) return;
    if (e.key === 'Escape') { set(false); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(), first = f[0], last = f[f.length - 1];
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  });

  return { open: () => set(true), close: () => set(false) };
}

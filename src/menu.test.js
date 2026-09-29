import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountMenu } from './menu.js';

function setup() {
  document.body.innerHTML = `
    <button id="btn" aria-expanded="false" aria-controls="menu" aria-label="Меню"></button>
    <div id="menu" role="dialog" aria-modal="true" aria-label="Разделы" hidden>
      <a href="#how">Начинка</a>
      <a href="#team">Команда</a>
    </div>`;
  const onToggle = vi.fn();
  mountMenu({ button: document.getElementById('btn'), panel: document.getElementById('menu'), onToggle });
  return { btn: document.getElementById('btn'), panel: document.getElementById('menu'), onToggle };
}

describe('меню на телефоне', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('кнопка открывает меню, переводит фокус внутрь и сообщает о состоянии', () => {
    const { btn, panel, onToggle } = setup();
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(onToggle).toHaveBeenLastCalledWith(true);
    expect(btn.getAttribute('aria-label')).toBe('Закрыть меню');
  });

  it('Esc закрывает меню и возвращает фокус на кнопку', () => {
    const { btn, panel, onToggle } = setup();
    btn.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.hidden).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(btn);
    expect(onToggle).toHaveBeenLastCalledWith(false);
    expect(btn.getAttribute('aria-label')).toBe('Меню');
  });

  it('ссылка и крестик в шапке закрывают меню', () => {
    const { btn, panel } = setup();
    btn.click();
    panel.querySelector('a').click();
    expect(panel.hidden).toBe(true);
    btn.click();
    btn.click();
    expect(panel.hidden).toBe(true);
  });

  it('Tab ходит по меню и крестику в шапке, наружу не выпускает', () => {
    const { btn, panel } = setup();
    btn.click();
    const links = panel.querySelectorAll('a');
    // с последнего пункта — на крестик: он вне панели, но в круге фокуса
    links[links.length - 1].focus();
    const e1 = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    document.dispatchEvent(e1);
    expect(e1.defaultPrevented).toBe(false);
    // с крестика — снова на первый пункт
    btn.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    expect(document.activeElement).toBe(links[0]);
  });
});

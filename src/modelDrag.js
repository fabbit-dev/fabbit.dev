// Горизонтальный жест вращает прибор; вертикальный и второй палец остаются браузеру.
export function mountModelDrag(canvas, { reduced = false, onChange = () => {} } = {}) {
  const drag = { ry: 0, active: false, used: false };
  let pointer = null, x0 = 0, y0 = 0, start = 0, target = 0, horizontal = false;
  const release = (event) => {
    if (event.pointerId !== pointer) return;
    const id = pointer;
    pointer = null;
    drag.active = horizontal = false;
    target = 0;
    if (reduced) drag.ry = 0;
    if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
    onChange();
  };
  canvas.addEventListener('pointerdown', (event) => {
    if (event.isPrimary === false && pointer !== null) { release({ pointerId: pointer }); return; }
    if (event.button !== 0 || pointer !== null || event.isPrimary === false) return;
    pointer = event.pointerId;
    x0 = event.clientX; y0 = event.clientY; target = start = drag.ry;
    // Мышь уже выбрала перетаскивание кнопкой; порог направления нужен только касанию.
    if (event.pointerType === 'mouse') {
      horizontal = drag.active = true;
      canvas.setPointerCapture?.(pointer);
      onChange();
    }
  });
  canvas.addEventListener('pointerleave', (event) => { if (!horizontal) release(event); });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer) return;
    const dx = event.clientX - x0, dy = event.clientY - y0;
    if (!horizontal) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { release(event); return; }
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      horizontal = drag.active = drag.used = true;
      canvas.setPointerCapture?.(pointer);
    }
    if (dx !== 0) drag.used = true;
    target = Math.max(-Math.PI, Math.min(Math.PI, start + dx / Math.max(1, canvas.clientWidth) * Math.PI * 1.6));
    if (reduced) drag.ry = target;
    onChange();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, release);
  drag.update = (dt) => {
    const difference = target - drag.ry;
    if (Math.abs(difference) < 1e-4) { drag.ry = target; return false; }
    drag.ry += difference * (reduced ? 1 : 1 - Math.exp(-dt * (drag.active ? 30 : 4)));
    return true;
  };
  return drag;
}

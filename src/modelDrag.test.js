import { beforeEach, expect, it, vi } from 'vitest';
import { mountModelDrag } from './modelDrag.js';

let canvas, drag, onChange;
const pointer = (type, x, y = 80, id = 1) => {
  const event = new Event(type);
  Object.assign(event, { pointerId: id, clientX: x, clientY: y, button: 0, isPrimary: id === 1 });
  canvas.dispatchEvent(event);
};
beforeEach(() => {
  canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 375 });
  canvas.setPointerCapture = vi.fn(); canvas.hasPointerCapture = () => true; canvas.releasePointerCapture = vi.fn();
  onChange = vi.fn(); drag = mountModelDrag(canvas, { onChange });
});
it('не захватывает тап и вертикальную прокрутку', () => {
  pointer('pointerdown', 100);
  expect(canvas.setPointerCapture).not.toHaveBeenCalled();
  pointer('pointermove', 102, 100);
  pointer('pointermove', 220, 110);
  drag.update(1 / 60);
  expect(drag.active).toBe(false); expect(drag.used).toBe(false); expect(drag.ry).toBe(0);
});
it('сглаживает поворот и возвращается в ракурс главы после отпускания', () => {
  pointer('pointerdown', 100); pointer('pointermove', 200);
  expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
  expect(drag.active).toBe(true); expect(drag.used).toBe(true); expect(onChange).toHaveBeenCalled();
  drag.update(1 / 60);
  expect(drag.ry).toBeGreaterThan(0); expect(drag.ry).toBeLessThan(100 / 375 * Math.PI * 1.6);
  pointer('pointerup', 200);
  for (let i = 0; i < 90; i++) drag.update(1 / 60);
  expect(drag.active).toBe(false); expect(drag.ry).toBe(0);
});
it('игнорирует второй палец и завершает отменённый жест', () => {
  pointer('pointerdown', 100); pointer('pointermove', 180);
  pointer('pointerdown', 200, 80, 2); pointer('pointermove', 350, 80, 2);
  pointer('pointercancel', 180);
  for (let i = 0; i < 90; i++) drag.update(1 / 60);
  expect(drag.active).toBe(false); expect(drag.ry).toBe(0);
});
it('тап с уходом мыши не оставляет зависший указатель', () => {
  pointer('pointerdown', 100); pointer('pointerleave', 100);
  pointer('pointerdown', 80); pointer('pointermove', 150);
  expect(drag.active).toBe(true);
});
it('при reduced-motion следует за пальцем без инерции', () => {
  canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 375 });
  drag = mountModelDrag(canvas, { reduced: true });
  pointer('pointerdown', 100); pointer('pointermove', 200);
  expect(drag.ry).toBeCloseTo(100 / 375 * Math.PI * 1.6);
  pointer('pointerup', 200); expect(drag.ry).toBe(0);
});

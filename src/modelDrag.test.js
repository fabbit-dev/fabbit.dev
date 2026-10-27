import { beforeEach, expect, it, vi } from 'vitest';
import { mountModelDrag } from './modelDrag.js';
import { frameDelta } from './modelMotion.js';

let canvas, drag, onChange;
const pointer = (type, x, y = 80, id = 1, pointerType = 'touch') => {
  const event = new Event(type);
  Object.assign(event, { pointerId: id, pointerType, clientX: x, clientY: y, button: 0, isPrimary: id === 1 });
  canvas.dispatchEvent(event);
};
beforeEach(() => {
  canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 375 });
  canvas.setPointerCapture = vi.fn(); canvas.hasPointerCapture = () => true; canvas.releasePointerCapture = vi.fn();
  onChange = vi.fn(); drag = mountModelDrag(canvas, { onChange });
});
it('не вращается от движения мыши без нажатия', () => {
  pointer('pointermove', 240, 100, 1, 'mouse');
  drag.update(1 / 60);
  expect(drag.ry).toBe(0); expect(drag.active).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
});
it('мышь захватывается сразу и не теряет диагональный жест', () => {
  pointer('pointerdown', 100, 80, 1, 'mouse');
  expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
  expect(drag.active).toBe(true);
  pointer('pointermove', 102, 100, 1, 'mouse');
  pointer('pointermove', 220, 110, 1, 'mouse');
  drag.update(1 / 60);
  expect(drag.ry).toBeGreaterThan(0);
  pointer('lostpointercapture', 220, 110, 1, 'mouse');
  for (let i = 0; i < 180; i++) drag.update(1 / 60);
  expect(drag.active).toBe(false); expect(drag.ry).toBe(0);
});
it('частые события перед RAF не разворачивают и не разгоняют модель от цели', () => {
  pointer('pointerdown', 100, 80, 1, 'mouse');
  for (let i = 1; i <= 60; i++) {
    pointer('pointermove', 100 + i * 2, 80, 1, 'mouse');
    const previous = drag.ry;
    // Метка кадра может предшествовать событию ввода, но затухание не должно идти назад.
    drag.update(frameDelta(i * 16, i * 16 + 4));
    expect(drag.ry).toBe(previous);
    drag.update(frameDelta(i * 16 + 16, i * 16));
    expect(drag.ry).toBeGreaterThanOrEqual(previous);
    expect(drag.ry).toBeLessThanOrEqual(i * 2 / 375 * Math.PI * 1.6);
  }
});
it('повторный захват останавливает возврат в текущем положении', () => {
  pointer('pointerdown', 100, 80, 1, 'mouse');
  pointer('pointermove', 220, 80, 1, 'mouse');
  drag.update(1 / 60);
  pointer('pointerup', 220, 80, 1, 'mouse');
  drag.update(1 / 60);
  const caught = drag.ry;
  pointer('pointerdown', 220, 80, 1, 'mouse');
  drag.update(1 / 60);
  expect(drag.ry).toBe(caught);
});
it('возвращается мягче, чем следует за мышью: 95% за 0,75 с', () => {
  pointer('pointerdown', 100, 80, 1, 'mouse');
  pointer('pointermove', 220, 80, 1, 'mouse');
  for (let i = 0; i < 30; i++) drag.update(1 / 60);
  const held = drag.ry;
  pointer('pointerup', 220, 80, 1, 'mouse');
  for (let i = 0; i < 6; i++) drag.update(1 / 60);
  expect(drag.ry / held).toBeCloseTo(Math.exp(-0.4));
  for (let i = 0; i < 39; i++) drag.update(1 / 60);
  expect(drag.ry / held).toBeCloseTo(Math.exp(-3));
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
  for (let i = 0; i < 180; i++) drag.update(1 / 60);
  expect(drag.active).toBe(false); expect(drag.ry).toBe(0);
});
it('игнорирует второй палец и завершает отменённый жест', () => {
  pointer('pointerdown', 100); pointer('pointermove', 180);
  pointer('pointerdown', 200, 80, 2); pointer('pointermove', 350, 80, 2);
  pointer('pointercancel', 180);
  for (let i = 0; i < 180; i++) drag.update(1 / 60);
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

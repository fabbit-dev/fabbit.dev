import gsap from 'gsap';
import { expect, it } from 'vitest';
import { dampPose } from './modelMotion.js';

it('успокаивает позу с настоящим служебным полем GSAP', () => {
  const state = { x: 0, ry: 0 }, target = { x: 0, ry: 0 }, keys = Object.keys(target);
  const tween = gsap.to(target, { x: 1, ry: -2.5, duration: 1, paused: true });
  tween.progress(1);
  expect(target._gsap).toBeDefined();
  let moving;
  for (let i = 0; i < 200; i++) moving = dampPose(state, target, keys, 0.15);
  expect(moving).toBe(0);
  expect(state).toEqual({ x: 1, ry: -2.5 });
  tween.kill();
});
it('восстанавливает повреждённую координату и поддерживает reduced-motion', () => {
  const state = { x: NaN, ry: 0 }, target = { x: 1, ry: 2 };
  dampPose(state, target, ['x', 'ry'], 1);
  expect(state).toEqual(target);
});

// Ввод может прийти после метки текущего RAF; отрицательное время разгоняет затухание от цели.
export function frameDelta(now, previous = now) {
  return Math.max(0, Math.min(0.1, (now - previous) / 1000));
}

// Ключи фиксируются до GSAP: его служебный target._gsap не должен попадать в позу и давать NaN.
export function dampPose(state, target, keys, factor) {
  let moving = 0;
  for (const key of keys) {
    if (!Number.isFinite(state[key])) state[key] = Number.isFinite(target[key]) ? target[key] : 0;
    const difference = target[key] - state[key];
    state[key] = Math.abs(difference) < 1e-4 ? target[key] : state[key] + difference * factor;
    moving = Math.max(moving, Math.abs(difference));
  }
  return moving;
}

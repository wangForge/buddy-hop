export const resolvePositiveNumber = (value, fallback) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;

export const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
export const clamp01 = (value) => clamp(value, 0, 1);
export const lerp = (start, end, progress) => start + (end - start) * progress;

export const easeOutQuart = (progress) => {
  const p = clamp01(progress);
  return 1 - Math.pow(1 - p, 4);
};

export const easeInPowerWithInitialVelocity = ({
  progress,
  initialVelocityRatio,
  power,
}) => {
  const p = clamp01(progress);
  const initialVelocity = clamp01(initialVelocityRatio);
  return initialVelocity * p + (1 - initialVelocity) * Math.pow(p, power);
};

export const getEaseInPowerVelocity = ({
  progress,
  initialVelocityRatio,
  power,
}) => {
  const p = clamp01(progress);
  const initialVelocity = clamp01(initialVelocityRatio);
  return initialVelocity + (1 - initialVelocity) * power * Math.pow(p, power - 1);
};

export const getDistance = (start, end) =>
  Math.hypot(end.x - start.x, end.y - start.y);

export const getVelocityToward = (start, end, speed) => {
  const distance = Math.max(0.0001, getDistance(start, end));
  return {
    x: ((end.x - start.x) / distance) * speed,
    y: ((end.y - start.y) / distance) * speed,
  };
};

export const getRemappedProgress = ({ progress, start, end }) => {
  const range = end - start;

  if (Math.abs(range) < 0.0001) {
    return 1;
  }

  return clamp01((progress - start) / range);
};

export const getProgressBetweenValues = ({ value, start, end }) => {
  const range = end - start;

  if (Math.abs(range) < 0.0001) {
    return 1;
  }

  return clamp01((value - start) / range);
};

export const getRandomBetween = (min, max) => min + Math.random() * (max - min);

export const pickRandom = (items) =>
  items[Math.floor(Math.random() * Math.max(1, items.length))];

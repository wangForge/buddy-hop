import { browser } from 'wxt/browser';

export const DEFAULT_BACKDROP_BLUR_PX = 2;
export const MIN_BACKDROP_BLUR_PX = 0;
export const MAX_BACKDROP_BLUR_PX = 20;
export const BACKDROP_BLUR_STEP_PX = 1;

const BACKDROP_BLUR_STORAGE_KEY = 'jumping-clawd:backdrop-blur-px';

export const normalizeBackdropBlur = (value: unknown) => {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_BACKDROP_BLUR_PX;
  }

  return Math.min(
    MAX_BACKDROP_BLUR_PX,
    Math.max(MIN_BACKDROP_BLUR_PX, Math.round(numericValue)),
  );
};

export const getStoredBackdropBlur = async () => {
  const result = await browser.storage.local.get(BACKDROP_BLUR_STORAGE_KEY);
  return normalizeBackdropBlur(result[BACKDROP_BLUR_STORAGE_KEY]);
};

export const saveStoredBackdropBlur = (blurPx: number) =>
  browser.storage.local.set({
    [BACKDROP_BLUR_STORAGE_KEY]: normalizeBackdropBlur(blurPx),
  });

export const readBackdropBlurChange = (
  changes: Record<string, { newValue?: unknown }>,
) => {
  const change = changes[BACKDROP_BLUR_STORAGE_KEY];

  if (!change) {
    return null;
  }

  return normalizeBackdropBlur(change.newValue);
};

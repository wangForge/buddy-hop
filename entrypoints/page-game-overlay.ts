import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import {
  DEFAULT_BACKDROP_BLUR_PX,
  getStoredBackdropBlur,
  normalizeBackdropBlur,
  readBackdropBlurChange,
} from '../src/extension/backdrop-blur';
import {
  CLOSE_GAME_MESSAGE,
  DEFAULT_GAME_MODE,
  type GameMode,
  GET_GAME_STATE_MESSAGE,
  OPEN_GAME_MESSAGE,
  type OpenGameMessage,
  SET_BACKDROP_BLUR_MESSAGE,
  type SetBackdropBlurMessage,
  isGameMode,
} from '../src/extension/messages';

const GAME_PAGE = '/game.html';
const OVERLAY_ID = 'jumping-clawd-game-overlay';
const PAGE_SURFACE_SEARCH_PARAM = 'surface';
const GAME_MODE_SEARCH_PARAM = 'mode';
const AUTO_PLAY_TOGGLE_MESSAGE_TYPE = 'toggle-auto-play';
const AUTO_PLAY_STATE_MESSAGE_TYPE = 'auto-play-state';
const CONTRAST_SWITCH_LUMINANCE = 0.179;
const CLEANUP_GLOBAL_KEY = '__jumpingClawdOverlayCleanup__';
const BLOCKED_PAGE_INPUT_EVENTS = [
  'beforeinput',
  'input',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'paste',
] as const;

type PageSurfaceTheme = 'light' | 'dark';

type RgbaColor = {
  a: number;
  b: number;
  g: number;
  r: number;
};

type SavedScrollStyles = {
  bodyOverflow: string | null;
  htmlOverflow: string;
};

type GlobalWithCleanup = typeof globalThis & {
  [CLEANUP_GLOBAL_KEY]?: () => void;
};

let overlayHost: HTMLDivElement | null = null;
let overlayFrame: HTMLIFrameElement | null = null;
let savedScrollStyles: SavedScrollStyles | null = null;
let backdropBlurPx = DEFAULT_BACKDROP_BLUR_PX;
let backdropBlurLoad: Promise<number> | null = null;
let currentGameMode: GameMode = DEFAULT_GAME_MODE;
let currentAutoPlayEnabled = false;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getCleanupTarget = () => globalThis as GlobalWithCleanup;

const isOpenGameMessage = (message: unknown): message is OpenGameMessage =>
  isObject(message) && message.type === OPEN_GAME_MESSAGE;

const isCloseGameControlMessage = (message: unknown) =>
  isObject(message) && message.type === CLOSE_GAME_MESSAGE;

const isGetGameStateMessage = (message: unknown) =>
  isObject(message) && message.type === GET_GAME_STATE_MESSAGE;

const isSetBackdropBlurMessage = (
  message: unknown,
): message is SetBackdropBlurMessage =>
  isObject(message) && message.type === SET_BACKDROP_BLUR_MESSAGE;

const isGameFrameCloseMessage = (message: unknown) =>
  isObject(message) &&
  message.source === 'jumping-clawd-game' &&
  message.type === 'close-game';

const isGameFrameAutoPlayStateMessage = (
  message: unknown,
): message is { autoPlay: boolean } =>
  isObject(message) &&
  message.source === 'jumping-clawd-game' &&
  message.type === AUTO_PLAY_STATE_MESSAGE_TYPE &&
  typeof message.autoPlay === 'boolean';

const getShortcutGameMode = (event: KeyboardEvent): GameMode | null => {
  if (
    !event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return null;
  }

  if (event.key === ',' || event.code === 'Comma') {
    return 'casual';
  }

  if (event.key === '.' || event.code === 'Period') {
    return 'challenge';
  }

  return null;
};

const isAutoPlayToggleShortcut = (event: KeyboardEvent) =>
  event.ctrlKey &&
  !event.altKey &&
  !event.metaKey &&
  !event.shiftKey &&
  (event.code === 'KeyA' || event.key.toLowerCase() === 'a');

const requestGameAutoPlayToggle = () => {
  overlayFrame?.contentWindow?.postMessage(
    {
      source: 'jumping-clawd-overlay',
      type: AUTO_PLAY_TOGGLE_MESSAGE_TYPE,
    },
    '*',
  );
};

const setImportantStyle = (
  element: HTMLElement,
  property: string,
  value: string,
) => {
  element.style.setProperty(property, value, 'important');
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const parseColorComponent = (component: string, scale = 255) => {
  const value = Number.parseFloat(component);

  if (!Number.isFinite(value)) {
    return null;
  }

  return component.trim().endsWith('%')
    ? clampNumber((value / 100) * scale, 0, scale)
    : clampNumber(value, 0, scale);
};

const parseAlphaComponent = (component: string | undefined) => {
  if (component === undefined) {
    return 1;
  }

  const alpha = parseColorComponent(component, 1);

  return alpha ?? 1;
};

const splitColorComponents = (value: string) =>
  value
    .trim()
    .replace(/\s*\/\s*/g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean);

const parseHexColor = (value: string): RgbaColor | null => {
  const match = value.trim().match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);

  if (!match) {
    return null;
  }

  const hex = match[1];
  const channels =
    hex.length <= 4
      ? Array.from(hex, (digit) => Number.parseInt(`${digit}${digit}`, 16))
      : (hex.length === 6 ? [0, 2, 4] : [0, 2, 4, 6]).map((index) =>
          Number.parseInt(hex.slice(index, index + 2), 16),
        );

  return {
    r: channels[0],
    g: channels[1],
    b: channels[2],
    a: channels[3] === undefined ? 1 : channels[3] / 255,
  };
};

const parseRgbColor = (value: string): RgbaColor | null => {
  const match = value.match(/rgba?\(([^)]+)\)/i);

  if (!match) {
    return null;
  }

  const components = splitColorComponents(match[1]);

  if (components.length < 3) {
    return null;
  }

  const r = parseColorComponent(components[0]);
  const g = parseColorComponent(components[1]);
  const b = parseColorComponent(components[2]);

  if (r === null || g === null || b === null) {
    return null;
  }

  return {
    r,
    g,
    b,
    a: parseAlphaComponent(components[3]),
  };
};

const parseSrgbColor = (value: string): RgbaColor | null => {
  const match = value.match(/color\(\s*srgb\s+([^)]+)\)/i);

  if (!match) {
    return null;
  }

  const components = splitColorComponents(match[1]);

  if (components.length < 3) {
    return null;
  }

  const r = parseColorComponent(components[0], 1);
  const g = parseColorComponent(components[1], 1);
  const b = parseColorComponent(components[2], 1);

  if (r === null || g === null || b === null) {
    return null;
  }

  return {
    r: r * 255,
    g: g * 255,
    b: b * 255,
    a: parseAlphaComponent(components[3]),
  };
};

const parseCssColor = (value: string): RgbaColor | null => {
  if (!value || value === 'transparent') {
    return null;
  }

  return parseHexColor(value) ?? parseRgbColor(value) ?? parseSrgbColor(value);
};

const blendColors = (top: RgbaColor, bottom: RgbaColor): RgbaColor => {
  const alpha = top.a + bottom.a * (1 - top.a);

  if (alpha <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  return {
    r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / alpha,
    g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / alpha,
    b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / alpha,
    a: alpha,
  };
};

const averageColors = (colors: RgbaColor[]): RgbaColor | null => {
  if (!colors.length) {
    return null;
  }

  const total = colors.reduce(
    (sum, color) => ({
      r: sum.r + color.r,
      g: sum.g + color.g,
      b: sum.b + color.b,
      a: sum.a + color.a,
    }),
    { r: 0, g: 0, b: 0, a: 0 },
  );

  return {
    r: total.r / colors.length,
    g: total.g / colors.length,
    b: total.b / colors.length,
    a: total.a / colors.length,
  };
};

const extractCssColors = (value: string) =>
  Array.from(value.matchAll(/(?:rgba?\([^)]+\)|color\(\s*srgb\s+[^)]+\))/gi))
    .map((match) => parseCssColor(match[0]))
    .filter((color): color is RgbaColor => Boolean(color));

const getBackgroundImageColor = (backgroundImage: string) => {
  if (!backgroundImage || backgroundImage === 'none') {
    return null;
  }

  return averageColors(extractCssColors(backgroundImage));
};

const getElementBackgroundColor = (element: Element): RgbaColor | null => {
  const style = window.getComputedStyle(element);

  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  ) {
    return null;
  }

  const opacityValue = Number.parseFloat(style.opacity);
  const opacity = Number.isFinite(opacityValue)
    ? clampNumber(opacityValue, 0, 1)
    : 1;

  if (opacity <= 0) {
    return null;
  }

  const backgroundColor =
    parseCssColor(style.backgroundColor) ?? { r: 0, g: 0, b: 0, a: 0 };
  const backgroundImageColor = getBackgroundImageColor(style.backgroundImage);
  const color = backgroundImageColor
    ? blendColors(backgroundImageColor, backgroundColor)
    : backgroundColor;

  return color.a > 0 ? { ...color, a: color.a * opacity } : null;
};

const getRelativeLuminance = (color: RgbaColor) => {
  const toLinear = (channel: number) => {
    const value = clampNumber(channel / 255, 0, 1);

    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  return (
    0.2126 * toLinear(color.r) +
    0.7152 * toLinear(color.g) +
    0.0722 * toLinear(color.b)
  );
};

const getSurfaceThemeForColor = (color: RgbaColor): PageSurfaceTheme =>
  getRelativeLuminance(color) > CONTRAST_SWITCH_LUMINANCE ? 'light' : 'dark';

const getMetaThemeColor = () => {
  const metaThemeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );

  return metaThemeColor?.content ? parseCssColor(metaThemeColor.content) : null;
};

const getFallbackPageSurfaceTheme = (): PageSurfaceTheme => {
  const themeColor = getMetaThemeColor();

  return themeColor ? getSurfaceThemeForColor(themeColor) : 'light';
};

const getSamplePointBackgroundColor = (
  x: number,
  y: number,
): RgbaColor | null => {
  const pageElements = document
    .elementsFromPoint(x, y)
    .filter((element) => element.id !== OVERLAY_ID)
    .reverse();
  const elementSet = new Set<Element>([
    document.documentElement,
    document.body,
    ...pageElements,
  ]);
  let composite: RgbaColor | null = null;

  elementSet.forEach((element) => {
    const backgroundColor = getElementBackgroundColor(element);

    if (!backgroundColor) {
      return;
    }

    composite = composite
      ? blendColors(backgroundColor, composite)
      : backgroundColor;
  });

  return composite
    ? blendColors(composite, { r: 255, g: 255, b: 255, a: 1 })
    : null;
};

const getStageSamplePoints = () => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (!viewportWidth || !viewportHeight) {
    return [];
  }

  const stageWidth = Math.min(viewportWidth, viewportHeight);
  const stageLeft = (viewportWidth - stageWidth) / 2;
  const xRatios = [0.14, 0.32, 0.5, 0.68, 0.86];
  const yRatios = [0.08, 0.2, 0.36, 0.54, 0.74, 0.92];

  return xRatios.flatMap((xRatio) =>
    yRatios.map((yRatio) => ({
      x: Math.round(stageLeft + stageWidth * xRatio),
      y: Math.round(viewportHeight * yRatio),
    })),
  );
};

const getPageSurfaceTheme = (): PageSurfaceTheme => {
  const luminanceSamples = getStageSamplePoints()
    .map(({ x, y }) => getSamplePointBackgroundColor(x, y))
    .filter((color): color is RgbaColor => Boolean(color))
    .map(getRelativeLuminance);

  if (!luminanceSamples.length) {
    return getFallbackPageSurfaceTheme();
  }

  const averageLuminance =
    luminanceSamples.reduce((sum, value) => sum + value, 0) /
    luminanceSamples.length;

  return averageLuminance > CONTRAST_SWITCH_LUMINANCE ? 'light' : 'dark';
};

const getGameModeFromMessage = (message: OpenGameMessage): GameMode =>
  isGameMode(message.mode) ? message.mode : DEFAULT_GAME_MODE;

const getGamePageUrl = (
  surfaceTheme: PageSurfaceTheme,
  gameMode: GameMode,
) => {
  const url = new URL(browser.runtime.getURL(GAME_PAGE));
  url.searchParams.set(PAGE_SURFACE_SEARCH_PARAM, surfaceTheme);
  url.searchParams.set(GAME_MODE_SEARCH_PARAM, gameMode);

  return url.toString();
};

const applyBackdropBlur = () => {
  overlayHost?.style.setProperty(
    '--jumping-clawd-backdrop-blur',
    `${backdropBlurPx}px`,
  );
};

const setBackdropBlur = (value: unknown) => {
  backdropBlurPx = normalizeBackdropBlur(value);
  applyBackdropBlur();

  return backdropBlurPx;
};

const loadBackdropBlur = () => {
  backdropBlurLoad ??= getStoredBackdropBlur()
    .then(setBackdropBlur)
    .catch((error) => {
      console.warn('Failed to load Jumping Clawd backdrop blur setting', error);
      return backdropBlurPx;
    });

  return backdropBlurLoad;
};

const lockPageScroll = () => {
  if (savedScrollStyles) {
    return;
  }

  savedScrollStyles = {
    htmlOverflow: document.documentElement.style.overflow,
    bodyOverflow: document.body?.style.overflow ?? null,
  };

  document.documentElement.style.overflow = 'hidden';
  if (document.body) {
    document.body.style.overflow = 'hidden';
  }
};

const restorePageScroll = () => {
  if (!savedScrollStyles) {
    return;
  }

  document.documentElement.style.overflow = savedScrollStyles.htmlOverflow;
  if (document.body && savedScrollStyles.bodyOverflow !== null) {
    document.body.style.overflow = savedScrollStyles.bodyOverflow;
  }
  savedScrollStyles = null;
};

const focusGameFrame = () => {
  requestAnimationFrame(() => {
    overlayFrame?.focus();
  });
};

const blurActivePageElement = () => {
  const activeElement = document.activeElement;

  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
};

const isOverlayOpen = () => Boolean(overlayHost?.isConnected);

const closeGameOverlay = () => {
  const wasOpen = isOverlayOpen();
  overlayHost?.remove();
  overlayHost = null;
  overlayFrame = null;
  currentGameMode = DEFAULT_GAME_MODE;
  currentAutoPlayEnabled = false;
  restorePageScroll();

  return wasOpen;
};

const createOverlayHost = (gameMode: GameMode) => {
  const host = document.createElement('div');
  host.id = OVERLAY_ID;
  host.style.setProperty('--jumping-clawd-backdrop-blur', `${backdropBlurPx}px`);
  setImportantStyle(host, 'position', 'fixed');
  setImportantStyle(host, 'inset', '0');
  setImportantStyle(host, 'width', '100vw');
  setImportantStyle(host, 'height', '100vh');
  setImportantStyle(host, 'z-index', '2147483647');
  setImportantStyle(host, 'pointer-events', 'auto');
  setImportantStyle(host, 'display', 'block');

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      .overlay {
        position: fixed;
        inset: 0;
        overflow: hidden;
        background: rgba(248, 250, 252, 0.2);
        pointer-events: auto;
      }

      .backdrop {
        position: absolute;
        inset: 0;
        z-index: 0;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08)),
          rgba(255, 255, 255, 0.12);
        -webkit-backdrop-filter: blur(var(--jumping-clawd-backdrop-blur, 2px)) saturate(1.1);
        backdrop-filter: blur(var(--jumping-clawd-backdrop-blur, 2px)) saturate(1.1);
      }

      iframe {
        position: absolute;
        inset: 0;
        z-index: 1;
        width: 100%;
        height: 100%;
        border: 0;
        background: transparent;
        color-scheme: light dark;
      }
    </style>
    <div class="overlay">
      <div class="backdrop"></div>
      <iframe title="Jumping Clawd game" allowtransparency="true"></iframe>
    </div>
  `;

  const iframe = shadow.querySelector<HTMLIFrameElement>('iframe');

  if (!iframe) {
    throw new Error('Failed to create Jumping Clawd overlay');
  }

  iframe.src = getGamePageUrl(getPageSurfaceTheme(), gameMode);
  iframe.addEventListener('load', focusGameFrame);

  return { host, iframe };
};

const openGameOverlay = async (gameMode: GameMode = DEFAULT_GAME_MODE) => {
  await loadBackdropBlur();

  if (overlayHost?.isConnected) {
    if (currentGameMode !== gameMode && overlayFrame) {
      currentGameMode = gameMode;
      currentAutoPlayEnabled = false;
      overlayFrame.src = getGamePageUrl(getPageSurfaceTheme(), gameMode);
      return 'switched';
    }

    focusGameFrame();
    return 'already-open';
  }

  const { host, iframe } = createOverlayHost(gameMode);
  overlayHost = host;
  overlayFrame = iframe;
  currentGameMode = gameMode;
  currentAutoPlayEnabled = false;
  lockPageScroll();
  blurActivePageElement();
  document.documentElement.append(host);
  focusGameFrame();

  return 'opened';
};

export default defineUnlistedScript({
  main() {
    const cleanupTarget = getCleanupTarget();
    cleanupTarget[CLEANUP_GLOBAL_KEY]?.();

    void loadBackdropBlur();

    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcutGameMode = getShortcutGameMode(event);

      if (shortcutGameMode) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void openGameOverlay(shortcutGameMode);
        return;
      }

      if (isAutoPlayToggleShortcut(event) && overlayHost?.isConnected) {
        event.preventDefault();
        event.stopImmediatePropagation();
        requestGameAutoPlayToggle();
        focusGameFrame();
        return;
      }

      if (event.key === 'Escape' && overlayHost?.isConnected) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeGameOverlay();
        return;
      }

      if (overlayHost?.isConnected) {
        event.preventDefault();
        event.stopImmediatePropagation();
        focusGameFrame();
      }
    };

    const handlePageInputEvent = (event: Event) => {
      if (!overlayHost?.isConnected) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      focusGameFrame();
    };

    const handleWindowFocus = () => {
      if (overlayHost?.isConnected) {
        focusGameFrame();
      }
    };

    const handleWindowMessage = (event: MessageEvent) => {
      if (!overlayFrame || event.source !== overlayFrame.contentWindow) {
        return;
      }

      if (isGameFrameCloseMessage(event.data)) {
        closeGameOverlay();
        return;
      }

      if (isGameFrameAutoPlayStateMessage(event.data)) {
        currentAutoPlayEnabled = event.data.autoPlay;
      }
    };

    const handleRuntimeMessage = (message: unknown) => {
      if (isOpenGameMessage(message)) {
        return openGameOverlay(getGameModeFromMessage(message)).then((state) => ({
          ok: true,
          state,
          isOpen: true,
          mode: currentGameMode,
          autoPlay: currentAutoPlayEnabled,
        }));
      }

      if (isCloseGameControlMessage(message)) {
        const wasOpen = closeGameOverlay();

        return Promise.resolve({
          ok: true,
          state: wasOpen ? 'closed' : 'already-closed',
          isOpen: false,
          mode: null,
          autoPlay: null,
        });
      }

      if (isGetGameStateMessage(message)) {
        return Promise.resolve({
          ok: true,
          state: isOverlayOpen() ? 'open' : 'closed',
          isOpen: isOverlayOpen(),
          mode: isOverlayOpen() ? currentGameMode : null,
          autoPlay: isOverlayOpen() ? currentAutoPlayEnabled : null,
        });
      }

      if (isSetBackdropBlurMessage(message)) {
        return Promise.resolve({
          ok: true,
          blurPx: setBackdropBlur(message.blurPx),
        });
      }

      return undefined;
    };

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName !== 'local') {
        return;
      }

      const blurPx = readBackdropBlurChange(changes);
      if (blurPx !== null) {
        setBackdropBlur(blurPx);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keypress', handlePageInputEvent, true);
    window.addEventListener('keyup', handlePageInputEvent, true);
    BLOCKED_PAGE_INPUT_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handlePageInputEvent, true);
    });
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('message', handleWindowMessage);
    browser.runtime.onMessage.addListener(handleRuntimeMessage);
    browser.storage.onChanged.addListener(handleStorageChange);

    cleanupTarget[CLEANUP_GLOBAL_KEY] = () => {
      closeGameOverlay();
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keypress', handlePageInputEvent, true);
      window.removeEventListener('keyup', handlePageInputEvent, true);
      BLOCKED_PAGE_INPUT_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handlePageInputEvent, true);
      });
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('message', handleWindowMessage);
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
      browser.storage.onChanged.removeListener(handleStorageChange);
      delete cleanupTarget[CLEANUP_GLOBAL_KEY];
    };
  },
});

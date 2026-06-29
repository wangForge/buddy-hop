import { browser } from 'wxt/browser';
import {
  CLOSE_GAME_MESSAGE,
  DEFAULT_GAME_MODE,
  type GameMode,
  GET_GAME_STATE_MESSAGE,
  OPEN_GAME_MESSAGE,
  isGameMode,
} from './messages';

const GAME_PAGE = '/game.html';
const AUTO_PLAY_SEARCH_PARAM = 'autoPlay';
const PAGE_GAME_OVERLAY_SCRIPT_PUBLIC_FILE = '/page-game-overlay.js';
const PAGE_GAME_OVERLAY_SCRIPT_INJECTION_FILE =
  PAGE_GAME_OVERLAY_SCRIPT_PUBLIC_FILE.slice(1) as typeof PAGE_GAME_OVERLAY_SCRIPT_PUBLIC_FILE;

export type GameOverlayState = {
  ok: true;
  state?: string;
  isOpen: boolean;
  mode?: GameMode | null;
  autoPlay?: boolean | null;
};

const STANDALONE_GAME_TAB_URL_PATTERNS = [
  /^about:(blank|newtab|srcdoc)([?#].*)?$/i,
  /^(chrome|edge|brave|vivaldi|opera):\/\/(newtab|new-tab-page|new-tab-page-third-party|startpage)\/?([?#].*)?$/i,
];

const shouldOpenStandaloneGameInTab = (url: string | undefined) =>
  typeof url !== 'string' ||
  url.trim() === '' ||
  STANDALONE_GAME_TAB_URL_PATTERNS.some((pattern) => pattern.test(url));

const getRuntimeGameUrl = (url: string | undefined) => {
  if (typeof url !== 'string') {
    return null;
  }

  try {
    const currentUrl = new URL(url);
    const gameUrl = new URL(browser.runtime.getURL(GAME_PAGE));

    return currentUrl.origin === gameUrl.origin &&
      currentUrl.pathname === gameUrl.pathname
      ? currentUrl
      : null;
  } catch {
    return null;
  }
};

const isStandaloneGameUrl = (url: string | undefined) =>
  getRuntimeGameUrl(url) !== null;

const getStandaloneGameMode = (url: string | undefined): GameMode => {
  const mode = getRuntimeGameUrl(url)?.searchParams.get('mode');

  return isGameMode(mode) ? mode : DEFAULT_GAME_MODE;
};

const getStandaloneGameAutoPlay = (url: string | undefined) =>
  getRuntimeGameUrl(url)?.searchParams.get(AUTO_PLAY_SEARCH_PARAM) === '1';

const getStandaloneGameUrl = (mode: GameMode) => {
  const url = new URL(browser.runtime.getURL(GAME_PAGE));
  url.searchParams.set('mode', mode);

  return url.toString();
};

const sendOpenGameMessage = (tabId: number, mode: GameMode) =>
  browser.tabs.sendMessage(tabId, {
    type: OPEN_GAME_MESSAGE,
    mode,
  });

const sendCloseGameMessage = (tabId: number) =>
  browser.tabs.sendMessage(tabId, {
    type: CLOSE_GAME_MESSAGE,
  });

const sendGetGameStateMessage = (tabId: number) =>
  browser.tabs.sendMessage(tabId, {
    type: GET_GAME_STATE_MESSAGE,
  });

const isMissingReceiverError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('Could not establish connection') ||
    message.includes('Receiving end does not exist')
  );
};

const injectContentScript = async (tabId: number) => {
  if (!browser.scripting?.executeScript) {
    throw new Error('The scripting API is unavailable');
  }

  await browser.scripting.executeScript({
    target: { tabId },
    files: [PAGE_GAME_OVERLAY_SCRIPT_INJECTION_FILE],
  });
};

const openStandaloneGameInTab = async (tabId: number, mode: GameMode) => {
  await browser.tabs.update(tabId, {
    url: getStandaloneGameUrl(mode),
  });

  return {
    ok: true,
    state: 'standalone-game-page',
    isOpen: true,
    mode,
    autoPlay: false,
  };
};

export const openGameInTab = async (
  tabId: number,
  mode: GameMode = DEFAULT_GAME_MODE,
) => {
  try {
    return await sendOpenGameMessage(tabId, mode);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    await injectContentScript(tabId);
    return sendOpenGameMessage(tabId, mode);
  }
};

export const openGameInActiveTab = async (
  mode: GameMode = DEFAULT_GAME_MODE,
) => {
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (activeTab?.id == null) {
    throw new Error('No active tab found');
  }

  if (shouldOpenStandaloneGameInTab(activeTab.url)) {
    return openStandaloneGameInTab(activeTab.id, mode);
  }

  if (isStandaloneGameUrl(activeTab.url)) {
    const currentMode = getStandaloneGameMode(activeTab.url);

    if (currentMode !== mode) {
      await browser.tabs.update(activeTab.id, {
        url: getStandaloneGameUrl(mode),
      });

      return {
        ok: true,
        state: 'switched',
        isOpen: true,
        mode,
        autoPlay: false,
      };
    }

    return {
      ok: true,
      state: 'already-open',
      isOpen: true,
      mode: currentMode,
      autoPlay: getStandaloneGameAutoPlay(activeTab.url),
    };
  }

  return openGameInTab(activeTab.id, mode);
};

export const closeGameInActiveTab = async (): Promise<GameOverlayState> => {
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (activeTab?.id == null) {
    throw new Error('No active tab found');
  }

  if (isStandaloneGameUrl(activeTab.url)) {
    await browser.tabs.update(activeTab.id, {
      url: 'about:blank',
    });

    return {
      ok: true,
      state: 'closed',
      isOpen: false,
      mode: null,
      autoPlay: null,
    };
  }

  if (shouldOpenStandaloneGameInTab(activeTab.url)) {
    return {
      ok: true,
      state: 'already-closed',
      isOpen: false,
      mode: null,
      autoPlay: null,
    };
  }

  try {
    return await sendCloseGameMessage(activeTab.id);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    return {
      ok: true,
      state: 'already-closed',
      isOpen: false,
      mode: null,
      autoPlay: null,
    };
  }
};

export const getGameStateInActiveTab = async (): Promise<GameOverlayState> => {
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (activeTab?.id == null) {
    throw new Error('No active tab found');
  }

  if (isStandaloneGameUrl(activeTab.url)) {
    return {
      ok: true,
      state: 'standalone-game-page',
      isOpen: true,
      mode: getStandaloneGameMode(activeTab.url),
      autoPlay: getStandaloneGameAutoPlay(activeTab.url),
    };
  }

  if (shouldOpenStandaloneGameInTab(activeTab.url)) {
    return {
      ok: true,
      state: 'closed',
      isOpen: false,
      mode: null,
      autoPlay: null,
    };
  }

  try {
    return await sendGetGameStateMessage(activeTab.id);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    return {
      ok: true,
      state: 'closed',
      isOpen: false,
      mode: null,
      autoPlay: null,
    };
  }
};

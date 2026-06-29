import { browser } from 'wxt/browser';
import {
  BACKDROP_BLUR_STEP_PX,
  DEFAULT_BACKDROP_BLUR_PX,
  MAX_BACKDROP_BLUR_PX,
  MIN_BACKDROP_BLUR_PX,
  getStoredBackdropBlur,
  normalizeBackdropBlur,
  saveStoredBackdropBlur,
} from '../../src/extension/backdrop-blur';
import {
  closeGameInActiveTab,
  getGameStateInActiveTab,
  openGameInActiveTab,
} from '../../src/extension/open-game';
import {
  DEFAULT_GAME_MODE,
  type GameMode,
  SET_BACKDROP_BLUR_MESSAGE,
  isGameMode,
} from '../../src/extension/messages';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing popup root');
}

app.innerHTML = `
  <main class="popup" aria-label="Jumping Clawd">
    <header class="popup-header">
      <div class="mascot-mark" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 274 178" focusable="false">
          <path d="M9.23 42.62H48.9V74.28H9.23V42.62Z" fill="#DA7756" />
          <path d="M224 42.62H264.17V74.28H224V42.62Z" fill="#DA7756" />
          <path d="M40.9 8.74H232.5V136.59H40.9V8.74Z" fill="#DA7756" />
          <path d="M57.4 144.59H72.79V172.77H57.4V144.59Z" fill="#DA7756" />
          <path d="M89.29 144.59H105.05V172.77H89.29V144.59Z" fill="#DA7756" />
          <path d="M168.67 144.59H184.27V172.77H168.67V144.59Z" fill="#DA7756" />
          <path d="M200.04 144.59H215.22V172.77H200.04V144.59Z" fill="#DA7756" />
          <path d="m73.24 42.62h16.26v30.66h-16.26v-30.66z" fill="#000" />
          <path d="m183.9 42.62h16.26v30.66h-16.26v-30.66z" fill="#000" />
        </svg>
      </div>
      <div class="brand-copy">
        <h1>Jumping Clawd</h1>
        <p>在当前页面跳一跳</p>
      </div>
    </header>

    <section class="shortcut-panel" aria-label="快捷键">
      <div class="shortcut-row">
        <span>休闲模式</span>
        <span class="key-combo" aria-label="Ctrl comma">
          <kbd>Ctrl</kbd>
          <span class="shortcut-plus">+</span>
          <kbd>,</kbd>
        </span>
      </div>
      <div class="shortcut-row">
        <span>挑战模式</span>
        <span class="key-combo" aria-label="Ctrl period">
          <kbd>Ctrl</kbd>
          <span class="shortcut-plus">+</span>
          <kbd>.</kbd>
        </span>
      </div>
      <div class="shortcut-row">
        <span>自动 play</span>
        <span class="key-combo" aria-label="Ctrl A">
          <kbd>Ctrl</kbd>
          <span class="shortcut-plus">+</span>
          <kbd>A</kbd>
        </span>
      </div>
      <div class="shortcut-row">
        <span>退出游戏</span>
        <span class="key-combo" aria-label="Escape">
          <kbd>Esc</kbd>
        </span>
      </div>
    </section>

    <div class="game-actions" aria-label="游戏控制">
      <button
        id="start-casual-game"
        class="game-button game-button--mode"
        type="button"
        aria-pressed="false"
      >
        休闲模式
      </button>
      <button
        id="start-challenge-game"
        class="game-button game-button--mode"
        type="button"
        aria-pressed="false"
      >
        挑战模式
      </button>
      <button id="exit-game" class="game-button game-button--secondary game-button--exit" type="button">
        退出游戏
      </button>
    </div>

    <section class="setting" aria-labelledby="backdrop-blur-label">
      <div class="setting-header">
        <label id="backdrop-blur-label" for="backdrop-blur">
          背景模糊
        </label>
        <output id="backdrop-blur-value" class="setting-value" for="backdrop-blur">
          ${DEFAULT_BACKDROP_BLUR_PX}px
        </output>
      </div>
      <input
        id="backdrop-blur"
        class="blur-slider"
        type="range"
        min="${MIN_BACKDROP_BLUR_PX}"
        max="${MAX_BACKDROP_BLUR_PX}"
        step="${BACKDROP_BLUR_STEP_PX}"
        value="${DEFAULT_BACKDROP_BLUR_PX}"
      />
    </section>

    <p id="status" class="status" role="status" aria-live="polite"></p>
  </main>
`;

const casualModeButton =
  document.querySelector<HTMLButtonElement>('#start-casual-game');
const challengeModeButton =
  document.querySelector<HTMLButtonElement>('#start-challenge-game');
const exitButton = document.querySelector<HTMLButtonElement>('#exit-game');
const backdropBlurSlider =
  document.querySelector<HTMLInputElement>('#backdrop-blur');
const backdropBlurValue =
  document.querySelector<HTMLOutputElement>('#backdrop-blur-value');
const statusText = document.querySelector<HTMLParagraphElement>('#status');

if (
  !casualModeButton ||
  !challengeModeButton ||
  !exitButton ||
  !backdropBlurSlider ||
  !backdropBlurValue ||
  !statusText
) {
  throw new Error('Missing popup controls');
}

type PendingAction = 'loading' | 'starting' | 'exiting' | null;

const modeButtons: Record<GameMode, HTMLButtonElement> = {
  casual: casualModeButton,
  challenge: challengeModeButton,
};

const normalizeGameMode = (value: unknown): GameMode =>
  isGameMode(value) ? value : DEFAULT_GAME_MODE;

let currentBackdropBlurPx = DEFAULT_BACKDROP_BLUR_PX;
let hasAdjustedBackdropBlur = false;
let isGameOpen = false;
let currentGameMode: GameMode | null = null;
let currentAutoPlayEnabled = false;
let pendingAction: PendingAction = 'loading';

const setStatus = (message: string) => {
  statusText.textContent = message;
};

const getOpenStatus = () =>
  `自动 play：${currentAutoPlayEnabled ? '开' : '关'}`;

const renderGameControls = () => {
  const isBusy = pendingAction !== null;

  Object.entries(modeButtons).forEach(([mode, button]) => {
    const isActive = isGameOpen && currentGameMode === mode;
    button.disabled = isBusy || isActive;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  exitButton.disabled = isBusy || !isGameOpen;
};

const isMissingReceiverError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('Could not establish connection') ||
    message.includes('Receiving end does not exist')
  );
};

const setBackdropBlurControlValue = (value: unknown) => {
  currentBackdropBlurPx = normalizeBackdropBlur(value);
  backdropBlurSlider.value = String(currentBackdropBlurPx);
  backdropBlurValue.textContent = `${currentBackdropBlurPx}px`;

  return currentBackdropBlurPx;
};

const sendBackdropBlurToActiveTab = async (blurPx: number) => {
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (activeTab?.id == null) {
    return;
  }

  try {
    await browser.tabs.sendMessage(activeTab.id, {
      type: SET_BACKDROP_BLUR_MESSAGE,
      blurPx,
    });
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      console.warn('Failed to update Jumping Clawd backdrop blur', error);
    }
  }
};

const handleBackdropBlurInput = () => {
  hasAdjustedBackdropBlur = true;
  const blurPx = setBackdropBlurControlValue(backdropBlurSlider.value);

  void saveStoredBackdropBlur(blurPx).catch((error) => {
    console.warn('Failed to save Jumping Clawd backdrop blur setting', error);
  });
  void sendBackdropBlurToActiveTab(blurPx);
};

void getStoredBackdropBlur()
  .then((blurPx) => {
    if (!hasAdjustedBackdropBlur) {
      setBackdropBlurControlValue(blurPx);
    }
  })
  .catch((error) => {
    console.warn('Failed to load Jumping Clawd backdrop blur setting', error);
  });

const syncGameState = async () => {
  pendingAction = 'loading';
  renderGameControls();

  try {
    const state = await getGameStateInActiveTab();
    isGameOpen = state.isOpen;
    currentGameMode = isGameOpen ? normalizeGameMode(state.mode) : null;
    currentAutoPlayEnabled = isGameOpen ? state.autoPlay === true : false;
    setStatus(isGameOpen ? getOpenStatus() : '');
  } catch (error) {
    console.warn('Failed to read Jumping Clawd game state', error);
    isGameOpen = false;
    currentGameMode = null;
    currentAutoPlayEnabled = false;
    setStatus('无法读取游戏状态');
  } finally {
    pendingAction = null;
    renderGameControls();
  }
};

const handleStartGame = async (mode: GameMode) => {
  if (pendingAction !== null || (isGameOpen && currentGameMode === mode)) {
    return;
  }

  pendingAction = 'starting';
  renderGameControls();
  setStatus(isGameOpen ? '正在切换...' : '正在打开...');

  try {
    const state = await openGameInActiveTab(mode);
    isGameOpen = true;
    currentGameMode = normalizeGameMode(state.mode ?? mode);
    currentAutoPlayEnabled = state.autoPlay === true;
    await sendBackdropBlurToActiveTab(currentBackdropBlurPx);
    setStatus(getOpenStatus());
    window.close();
  } catch (error) {
    console.warn('Failed to open Jumping Clawd game', error);
    isGameOpen = false;
    currentGameMode = null;
    currentAutoPlayEnabled = false;
    setStatus('当前页面无法打开游戏');
  } finally {
    pendingAction = null;
    renderGameControls();
  }
};

const handleExitGame = async () => {
  if (pendingAction !== null || !isGameOpen) {
    return;
  }

  pendingAction = 'exiting';
  renderGameControls();
  setStatus('正在退出...');

  try {
    const state = await closeGameInActiveTab();
    isGameOpen = state.isOpen;
    currentGameMode = state.isOpen ? normalizeGameMode(state.mode) : null;
    currentAutoPlayEnabled = state.isOpen ? state.autoPlay === true : false;
    setStatus(state.state === 'already-closed' ? '游戏未打开' : '已退出');
  } catch (error) {
    console.warn('Failed to close Jumping Clawd game', error);
    setStatus('当前页面无法退出游戏');
  } finally {
    pendingAction = null;
    renderGameControls();
  }
};

Object.entries(modeButtons).forEach(([mode, button]) => {
  button.addEventListener('click', () => {
    void handleStartGame(normalizeGameMode(mode));
  });
});

exitButton.addEventListener('click', () => {
  void handleExitGame();
});

backdropBlurSlider.addEventListener('input', handleBackdropBlurInput);

renderGameControls();
void syncGameState();

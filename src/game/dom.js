import {
  getCharacterById,
  getInitialCharacterId,
} from './characters.js';

const getRequiredElement = (selector) => {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
};

const platformElements = Array.from(document.querySelectorAll("[data-platform]"));
const stageElement = getRequiredElement("[data-stage]");
const clawdSmearElement = getRequiredElement("[data-clawd-smear]");
const clawdVelocityElement = getRequiredElement("[data-clawd-velocity]");

export const initialCharacter = getCharacterById(getInitialCharacterId());
clawdSmearElement.innerHTML = initialCharacter.smearSvg;
clawdVelocityElement.innerHTML = initialCharacter.bodySvg;
const GAME_OVER_MODAL_CONTENT = `
  <div class="game-over__panel">
    <strong class="game-over__final-score" data-final-score>0</strong>
    <div class="game-over__actions">
      <button class="game-over__button game-over__button--primary" data-retry-game type="button">
        \u518D\u6765\u4E00\u6B21
      </button>
      <button class="game-over__button game-over__button--secondary" data-exit-game type="button">
        \u9000\u51FA
      </button>
    </div>
  </div>
`;

const ensureGameOverModalMarkup = (modal) => {
  if (!modal.querySelector("[data-final-score]")) {
    modal.innerHTML = GAME_OVER_MODAL_CONTENT;
  }

  return modal;
};

const createGameOverModal = () => {
  const modal = document.createElement("div");
  modal.className = "game-over";
  modal.dataset.gameOver = "";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "game-over-title");
  modal.hidden = true;
  modal.innerHTML = GAME_OVER_MODAL_CONTENT;
  stageElement.append(modal);

  return modal;
};

const getGameOverModal = () =>
  ensureGameOverModalMarkup(
    document.querySelector("[data-game-over]") ?? createGameOverModal(),
  );

const getRequiredChildElement = (parent, selector) => {
  const element = parent.querySelector(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
};

const gameOverModal = getGameOverModal();

export const elements = {
  stage: stageElement,
  scoreValue: getRequiredElement("[data-score]"),
  chargeMeter: getRequiredElement("[data-charge-meter]"),
  chargeFill: getRequiredElement("[data-charge-fill]"),
  controlsHint: getRequiredElement("[data-controls-hint]"),
  clawdBody: getRequiredElement("[data-clawd-body]"),
  clawdSmear: getRequiredElement("[data-clawd-smear]"),
  clawdVelocity: getRequiredElement("[data-clawd-velocity]"),
  bodyLeftArm: getRequiredElement("[data-left-arm]"),
  bodyRightArm: getRequiredElement("[data-right-arm]"),
  smearLeftArm: getRequiredElement("[data-left-arm-smear]"),
  smearRightArm: getRequiredElement("[data-right-arm-smear]"),
  spikes: getRequiredElement("[data-spikes]"),
  spikesSvg: getRequiredElement("[data-spikes-svg]"),
  spikesPath: getRequiredElement("[data-spikes-path]"),
  bottomSpikes: getRequiredElement("[data-bottom-spikes]"),
  bottomSpikesSvg: getRequiredElement("[data-bottom-spikes-svg]"),
  bottomSpikesPath: getRequiredElement("[data-bottom-spikes-path]"),
  gameOverModal,
  finalScoreValue: getRequiredChildElement(gameOverModal, "[data-final-score]"),
  retryGameButton: getRequiredChildElement(gameOverModal, "[data-retry-game]"),
  exitGameButton: getRequiredChildElement(gameOverModal, "[data-exit-game]"),
  platforms: Object.fromEntries(
    platformElements.map((platform) => [platform.dataset.platform, platform]),
  ),
};

export const platformIds = platformElements.map(
  (platform) => platform.dataset.platform,
);

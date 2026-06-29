const getRequiredElement = (selector) => {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
};

const platformElements = Array.from(document.querySelectorAll("[data-platform]"));
const stageElement = getRequiredElement("[data-stage]");
const GAME_OVER_MODAL_CONTENT = `
  <div class="game-over__panel">
    <section class="game-over__leaderboard" aria-labelledby="game-over-title">
      <h2 id="game-over-title">\u6392\u884C\u699C</h2>
      <ol class="game-over__rank-list" data-rank-list></ol>
    </section>
    <form class="game-over__submit" data-score-form>
      <div class="game-over__submit-body">
        <label class="game-over__field">
          <input
            data-player-name
            type="text"
            maxlength="24"
            autocomplete="off"
            inputmode="text"
            aria-label="\u8F93\u5165\u4F60\u7684\u5927\u540D"
          />
        </label>
        <strong class="game-over__final-score" data-final-score>0</strong>
        <button class="game-over__send" data-submit-score type="submit" aria-label="\u4E0A\u699C">
          \u4E0A\u699C\uD83D\uDC46
        </button>
      </div>
    </form>
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
  if (
    !modal.querySelector("[data-rank-list]") ||
    !modal.querySelector("[data-score-form]") ||
    !modal.querySelector("[data-submit-score]")
  ) {
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
  rankList: getRequiredChildElement(gameOverModal, "[data-rank-list]"),
  finalScoreValue: getRequiredChildElement(gameOverModal, "[data-final-score]"),
  scoreForm: getRequiredChildElement(gameOverModal, "[data-score-form]"),
  playerNameInput: getRequiredChildElement(gameOverModal, "[data-player-name]"),
  submitScoreButton: getRequiredChildElement(gameOverModal, "[data-submit-score]"),
  retryGameButton: getRequiredChildElement(gameOverModal, "[data-retry-game]"),
  exitGameButton: getRequiredChildElement(gameOverModal, "[data-exit-game]"),
  platforms: Object.fromEntries(
    platformElements.map((platform) => [platform.dataset.platform, platform]),
  ),
};

export const platformIds = platformElements.map(
  (platform) => platform.dataset.platform,
);

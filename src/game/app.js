import {
  ANTICIPATION_SCALE_X,
  ARM_MAX_UP_SWING_DEGREES,
  ARM_PIVOTS,
  ARM_TAKEOFF_DOWN_SWING_DEGREES,
  BASELINE_ANIMATION_FPS,
  BOTTOM_DEATH_DURATION_FRAMES,
  BOTTOM_DEATH_FALL_FRAMES,
  BOTTOM_DEATH_FALL_TILT_DEGREES,
  CHARGE_COLOR_HIGH,
  CHARGE_COLOR_LOW,
  CHARGE_COLOR_PERFECT,
  CHARGE_COLOR_TOP,
  CHARGE_FULL_HOLD_MS,
  CHARGE_MAX_LIFT_RATIO,
  CHARGE_MAX_MS,
  CHARGE_METER_GAP_RATIO,
  CHARGE_METER_HEIGHT_RATIO,
  CHARGE_METER_STAGE_PADDING,
  CHARGE_METER_WIDTH_RATIO,
  CHARGE_MIN_LIFT_RATIO,
  CHARGE_PERFECT_CLEARANCE_RATIO,
  CLAWD_ASPECT_RATIO,
  CLAWD_BOTTOM_PADDING_RATIO,
  CLAWD_HEIGHT_RATIO,
  CLAWD_JUMP_TIMING,
  CLAWD_SCENE_SCALE,
  CLAWD_TOP_PADDING_RATIO,
  CHALLENGE_CURRENT_SURFACE_RATIO,
  CHALLENGE_MODE_CHARGE_INITIAL_SPEED_MULTIPLIER,
  CHALLENGE_MODE_DRIFT_INITIAL_SPEED_RATIO,
  CHALLENGE_TARGET_HORIZONTAL_DISTANCE_MAX_RATIO,
  CHALLENGE_TARGET_HORIZONTAL_DISTANCE_MIN_RATIO,
  CHALLENGE_TARGET_VERTICAL_GAP_MAX_RATIO,
  CHALLENGE_TARGET_VERTICAL_GAP_MIN_RATIO,
  CYCLE_DURATION_FRAMES,
  CURRENT_SURFACE_RATIO,
  JUMP_HANGTIME_LIFT_RATIO,
  LANDING_IMPACT_REFERENCE_SPEED_RATIO,
  MAX_CLAWD_HEIGHT,
  MIN_CLAWD_HEIGHT,
  PLATFORM_SURFACE_MAX_RATIO,
  PLATFORM_SURFACE_MIN_RATIO,
  PLATFORM_VISUAL_THICKNESS_MIN,
  PLATFORM_VISUAL_THICKNESS_MULTIPLIER,
  PLATFORM_WIDTH_MAX_RATIO,
  PLATFORM_WIDTH_MIN_RATIO,
  RESPAWN_FLASH_DURATION_MS,
  SPIKE_HEIGHT_MAX,
  SPIKE_HEIGHT_MIN,
  SPIKE_HEIGHT_RATIO,
  SPIKE_WIDTH_TO_HEIGHT_RATIO,
  TAKEOFF_SMEAR_MAX_EXTRA_SCALE_Y,
  TAKEOFF_SMEAR_MAX_OPACITY,
  TARGET_HORIZONTAL_DISTANCE_MAX_RATIO,
  TARGET_HORIZONTAL_DISTANCE_MIN_RATIO,
  TARGET_VERTICAL_GAP_MAX_RATIO,
  TARGET_VERTICAL_GAP_MIN_RATIO,
  TOP_DEATH_DURATION_FRAMES,
  TOP_DEATH_FALL_DISTANCE_RATIO,
  TOP_DEATH_FALL_FRAMES,
  TOP_DEATH_FALL_TILT_DEGREES,
  TOP_DEATH_IMPACT_HOLD_FRAMES,
} from "./config.js";
import {
  getClawdArmSwingDegrees,
  getClawdJumpState,
  getRenderFrameFromAnimationFrame,
  getSmearSkewDegrees,
  getSmearTrailDirectionY,
  getTakeoffSmearSpeedFactors,
  getVelocityStretch,
} from "./clawd-motion.js";
import { elements, platformIds } from "./dom.js";
import {
  clamp,
  clamp01,
  easeOutQuart,
  getRandomBetween,
  lerp,
  pickRandom,
} from "./math.js";
import {
  fetchLeaderboardEntries,
  upsertLeaderboardEntry,
  normalizeName,
} from "./leaderboard.js";

const PAGE_SURFACE_THEMES = new Set(["light", "dark"]);
const GAME_MODES = new Set(["casual", "challenge"]);
const DEFAULT_GAME_MODE = "casual";
const AUTO_PLAY_SEARCH_PARAM = "autoPlay";
const AUTO_PLAY_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const AUTO_PLAY_TOGGLE_MESSAGE_TYPE = "toggle-auto-play";
const AUTO_PLAY_STATE_MESSAGE_TYPE = "auto-play-state";
const AUTO_PLAY_POWER_STEP = 0.002;
const AUTO_PLAY_JUMP_SAMPLE_FRAME_STEP = 0.5;
const AUTO_PLAY_RELEASE_TOLERANCE = AUTO_PLAY_POWER_STEP * 1.5;
const AUTO_PLAY_SAFE_POWER_MARGIN = 0.018;
const searchParams = new URLSearchParams(window.location.search);

const getInitialPageSurfaceTheme = () => {
  const surfaceTheme = searchParams.get("surface");

  if (PAGE_SURFACE_THEMES.has(surfaceTheme)) {
    return surfaceTheme;
  }

  return "light";
};

const getInitialGameMode = () => {
  const mode = searchParams.get("mode");

  return GAME_MODES.has(mode) ? mode : DEFAULT_GAME_MODE;
};

const getInitialAutoPlayEnabled = () =>
  AUTO_PLAY_TRUE_VALUES.has(
    String(searchParams.get(AUTO_PLAY_SEARCH_PARAM) ?? "").toLowerCase(),
  );

const pageSurfaceTheme = getInitialPageSurfaceTheme();
document.documentElement.dataset.pageSurface = pageSurfaceTheme;
document.documentElement.dataset.gameContext = PAGE_SURFACE_THEMES.has(
  searchParams.get("surface"),
)
  ? "overlay"
  : "standalone";
const gameMode = getInitialGameMode();
document.documentElement.dataset.gameMode = gameMode;
const isChallengeMode = () => gameMode === "challenge";
let autoPlayEnabled = getInitialAutoPlayEnabled();
document.documentElement.dataset.autoPlay = String(autoPlayEnabled);

const {
  stage,
  scoreValue,
  chargeMeter,
  chargeFill,
  controlsHint,
  clawdBody,
  clawdSmear,
  clawdVelocity,
  bodyLeftArm,
  bodyRightArm,
  smearLeftArm,
  smearRightArm,
  spikes,
  spikesSvg,
  spikesPath,
  bottomSpikes,
  bottomSpikesSvg,
  bottomSpikesPath,
  gameOverModal,
  rankList,
  finalScoreValue,
  scoreForm,
  playerNameInput,
  submitScoreButton,
  retryGameButton,
  exitGameButton,
  platforms,
} = elements;

let stageSize = { width: 0, height: 0 };
let platformThickness = 4;
let platformVisualThickness = 8;
let spikeHeight = 36;
let initialized = false;
let frameRequest = 0;
// World surface height that maps to the current ledge position on screen.
let cameraSurfaceY = 0;
const challengeModeDrift = {
  startedAt: 0,
  lastAppliedAt: 0,
};

const clawdSize = {
  height: 150,
  width: 150 * CLAWD_ASPECT_RATIO,
  topPadding: 150 * CLAWD_TOP_PADDING_RATIO,
  bottomPadding: 150 * CLAWD_BOTTOM_PADDING_RATIO,
};

const createPlatformMap = (createValue) =>
  Object.fromEntries(platformIds.map((id) => [id, createValue(id)]));

const JUMP_RELEASE_START_FRAME = getRenderFrameFromAnimationFrame({
  animationFrame: CLAWD_JUMP_TIMING.jumpStartFrame,
  fps: BASELINE_ANIMATION_FPS,
});
const JUMP_CAMERA_START_FRAME = getRenderFrameFromAnimationFrame({
  animationFrame: CLAWD_JUMP_TIMING.landingFrame,
  fps: BASELINE_ANIMATION_FPS,
});
const JUMP_CAMERA_DURATION_FRAMES = Math.max(
  1,
  CYCLE_DURATION_FRAMES - JUMP_CAMERA_START_FRAME,
);
const BOTTOM_DEATH_FALL_START_FRAME = getRenderFrameFromAnimationFrame({
  animationFrame: CLAWD_JUMP_TIMING.ascentEndFrame,
  fps: BASELINE_ANIMATION_FPS,
});
const BOTTOM_DEATH_TILT_START_FRAME = getRenderFrameFromAnimationFrame({
  animationFrame: CLAWD_JUMP_TIMING.exitAccelerationStartFrame,
  fps: BASELINE_ANIMATION_FPS,
});
const BOTTOM_DEATH_COLLISION_FRAME =
  BOTTOM_DEATH_FALL_START_FRAME + BOTTOM_DEATH_FALL_FRAMES;
const getJumpCameraProgress = (progress) => {
  const p = clamp01(progress);

  return p * p * (3 - 2 * p);
};

const platformPositions = createPlatformMap(() => ({ x: 0, surfaceY: 0 }));
const platformWidths = createPlatformMap(() => 0);
const platformGenerated = createPlatformMap(() => false);

const game = {
  phase: "ready",
  current: platformIds[0],
  target: platformIds[1],
  platformQueue: [...platformIds],
  score: 0,
  chargeStartedAt: 0,
  chargeCycleStartedAt: 0,
  chargePower: 0,
  jump: null,
  respawnStartedAt: 0,
};

const RANK_VISIBLE_ROWS = 5;
const RANK_ENTRY_LIMIT = 10;
const PLAYER_NAME_STORAGE_KEY = "jumping-clawd:player-name";
const CONTROLS_HINT_STORAGE_KEY_PREFIX =
  "jumping-clawd:controls-hint-shown";

const claimFirstControlsHintForMode = () => {
  const storageKey = `${CONTROLS_HINT_STORAGE_KEY_PREFIX}:${gameMode}`;

  try {
    if (localStorage.getItem(storageKey) === "1") {
      return false;
    }

    localStorage.setItem(storageKey, "1");
  } catch {
    // Keep the hint available when extension storage is unavailable.
  }

  return true;
};

let isAwaitingFirstSpace = claimFirstControlsHintForMode();
controlsHint.hidden = !isAwaitingFirstSpace;

const rankState = {
  entries: [],
  highlightedEntryId: null,
  hasLoaded: false,
  isLoading: false,
  isSubmitting: false,
  hasSubmittedCurrentScore: false,
  error: null,
};

let rankLoadId = 0;
let rankLoadPromise = null;

const getPlayerName = () => playerNameInput.value.trim();

const sortRankEntries = (entries) =>
  [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
  });

const getRankEntries = () =>
  sortRankEntries(rankState.entries)
    .slice(0, RANK_ENTRY_LIMIT)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

const renderRankStatus = (message) => {
  const row = document.createElement("li");
  row.className = "game-over__rank-row is-status";
  row.textContent = message;
  rankList.append(row);
};

const updateRankFade = () => {
  const rows = rankList.querySelectorAll(".game-over__rank-row:not(.is-status)");
  if (rows.length <= RANK_VISIBLE_ROWS) {
    rankList.classList.remove("can-scroll-up", "can-scroll-down");
    return;
  }

  const atTop = rankList.scrollTop < 2;
  const atBottom =
    rankList.scrollTop + rankList.clientHeight >=
    rankList.scrollHeight - 2;

  rankList.classList.toggle("can-scroll-up", !atTop);
  rankList.classList.toggle("can-scroll-down", !atBottom);
};

const renderRankList = () => {
  rankList.textContent = "";

  const entries = getRankEntries();

  if (entries.length === 0) {
    renderRankStatus(
      rankState.isLoading && !rankState.hasLoaded
        ? "加载中"
        : rankState.error
          ? "榜单暂时连不上"
          : "暂无记录",
    );
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("li");
    row.className = "game-over__rank-row";
    row.classList.toggle("is-player", entry.id === rankState.highlightedEntryId);

    const rank = document.createElement("span");
    rank.className = "game-over__rank-number";
    rank.textContent = String(entry.rank);

    const name = document.createElement("span");
    name.className = "game-over__rank-name";
    name.textContent = entry.name;

    const score = document.createElement("span");
    score.className = "game-over__rank-score";
    score.textContent = String(entry.score);

    row.append(rank, name, score);
    rankList.append(row);
  });

  updateRankFade();
};

const updateScoreSubmitState = () => {
  submitScoreButton.disabled =
    rankState.isSubmitting ||
    rankState.hasSubmittedCurrentScore ||
    getPlayerName().length === 0 ||
    game.score === 0;
};

const loadRankEntries = () => {
  if (rankLoadPromise) {
    return rankLoadPromise;
  }

  const loadId = rankLoadId + 1;
  rankLoadId = loadId;
  rankState.isLoading = true;
  rankState.error = null;
  renderRankList();

  const loadPromise = (async () => {
    try {
      const entries = await fetchLeaderboardEntries();

      if (loadId !== rankLoadId) {
        return;
      }

      rankState.entries = entries;
      rankState.hasLoaded = true;
      rankState.error = null;
    } catch (error) {
      if (loadId !== rankLoadId) {
        return;
      }

      rankState.error = error;
      console.warn("Failed to load leaderboard", error);
    } finally {
      if (loadId === rankLoadId) {
        rankState.isLoading = false;
        renderRankList();
      }

      if (rankLoadPromise === loadPromise) {
        rankLoadPromise = null;
      }
    }
  })();

  rankLoadPromise = loadPromise;
  return loadPromise;
};

const mergeRankEntry = (entry) => {
  const entriesById = new Map(rankState.entries.map((item) => [item.id, item]));
  entriesById.set(entry.id, entry);
  rankState.entries = sortRankEntries([...entriesById.values()]);
};

const submitPlayerScore = async () => {
  if (rankState.hasSubmittedCurrentScore) {
    return;
  }

  const name = getPlayerName();

  if (!name) {
    updateScoreSubmitState();
    playerNameInput.focus({ preventScroll: true });
    return;
  }

  rankState.isSubmitting = true;
  rankState.error = null;
  submitScoreButton.classList.remove("is-sent");
  submitScoreButton.textContent = "提交中";
  updateScoreSubmitState();

  try {
    const existingEntry = rankState.entries.find(
      (entry) => entry.name === normalizeName(name),
    );

    if (existingEntry && existingEntry.score >= game.score) {
      rankState.highlightedEntryId = existingEntry.id;
      rankState.hasSubmittedCurrentScore = true;
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
      renderRankList();
      submitScoreButton.classList.add("is-sent");
      submitScoreButton.textContent = "已有更高分";
      return;
    }

    const entry = await upsertLeaderboardEntry({
      name,
      score: game.score,
    });

    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
    rankState.highlightedEntryId = entry.id;
    rankState.hasSubmittedCurrentScore = true;
    mergeRankEntry(entry);
    renderRankList();
    submitScoreButton.classList.add("is-sent");
    submitScoreButton.textContent = "已上榜";
    void loadRankEntries();
  } catch (error) {
    rankState.error = error;
    console.warn("Failed to submit score", error);
    submitScoreButton.textContent = "重试";
    renderRankList();
  } finally {
    rankState.isSubmitting = false;
    updateScoreSubmitState();
  }
};

const prefetchLeaderboard = () => {
  if (!isChallengeMode()) {
    return;
  }

  void loadRankEntries();
};

const getStageRect = () => stage.getBoundingClientRect();
const getVisibleClawdHeight = () => clawdSize.height - clawdSize.bottomPadding;
const getClawdBodyCollisionHeight = () =>
  clawdSize.height - clawdSize.topPadding - clawdSize.bottomPadding;
const getJumpHangtimeLift = () => stageSize.height * JUMP_HANGTIME_LIFT_RATIO;
const getSpikeTipSurfaceY = () => stageSize.height - spikeHeight;
const getBottomSpikeTipSurfaceY = () => spikeHeight;
const getBottomSpikeHitSurfaceY = () => getBottomSpikeTipSurfaceY();
const getClawdBodyTopY = (motion, bodyCollisionHeight) =>
  motion.surfaceY + bodyCollisionHeight * motion.scaleY;
const getBottomSpikeCollisionSurfaceY = () => getBottomSpikeHitSurfaceY();
const getJumpLift = (power) =>
  lerp(
    stageSize.height * CHARGE_MIN_LIFT_RATIO,
    stageSize.height * CHARGE_MAX_LIFT_RATIO,
    clamp01(power),
  );

const resetChallengeModeDrift = (now) => {
  challengeModeDrift.startedAt = now;
  challengeModeDrift.lastAppliedAt = now;
};

const getChallengeModeDriftSpeedIntegral = ({ startSeconds, endSeconds }) => {
  const durationSeconds = Math.max(0, endSeconds - startSeconds);

  return CHALLENGE_MODE_DRIFT_INITIAL_SPEED_RATIO * durationSeconds;
};

const canApplyChallengeModeDrift = () =>
  game.phase === "ready" ||
  game.phase === "charging" ||
  game.phase === "jumping";

const getJumpElapsedFrame = ({ jump, now }) =>
  jump.startFrame + ((now - jump.startedAt) / 1000) * BASELINE_ANIMATION_FPS;

const getJumpTimeAtFrame = ({ jump, frame }) =>
  jump.startedAt + ((frame - jump.startFrame) / BASELINE_ANIMATION_FPS) * 1000;

const getPredictedChallengeJumpCameraOffset = ({
  startedAt,
  startFrame,
  frame,
}) => {
  if (!isChallengeMode()) {
    return 0;
  }

  const frameSeconds = Math.max(
    0,
    (frame - startFrame) / BASELINE_ANIMATION_FPS,
  );

  if (frameSeconds <= 0) {
    return 0;
  }

  const driftStartedAt = challengeModeDrift.startedAt || startedAt;
  const startSeconds = Math.max(0, (startedAt - driftStartedAt) / 1000);
  const endSeconds = Math.max(
    startSeconds,
    (startedAt + frameSeconds * 1000 - driftStartedAt) / 1000,
  );

  return (
    stageSize.height *
    getChallengeModeDriftSpeedIntegral({
      startSeconds,
      endSeconds,
    })
  );
};

const getChallengeModeDriftAppliedUntil = (now) => {
  if (
    isChallengeMode() &&
    game.phase === "jumping" &&
    (game.jump?.outcome === "top" || game.jump?.outcome === "low") &&
    typeof game.jump.freezeFrame === "number"
  ) {
    return Math.min(
      now,
      getJumpTimeAtFrame({
        jump: game.jump,
        frame: game.jump.freezeFrame,
      }),
    );
  }

  return now;
};

const applyChallengeModeDrift = (now) => {
  if (!isChallengeMode() || !stageSize.height) {
    return;
  }

  if (!challengeModeDrift.startedAt || !challengeModeDrift.lastAppliedAt) {
    resetChallengeModeDrift(now);
    return;
  }

  if (!canApplyChallengeModeDrift()) {
    challengeModeDrift.lastAppliedAt = now;
    return;
  }

  const appliedUntil = getChallengeModeDriftAppliedUntil(now);

  if (appliedUntil <= challengeModeDrift.lastAppliedAt) {
    challengeModeDrift.lastAppliedAt = now;
    return;
  }

  const deltaSeconds = Math.max(
    0,
    (appliedUntil - challengeModeDrift.lastAppliedAt) / 1000,
  );

  if (deltaSeconds <= 0) {
    challengeModeDrift.lastAppliedAt = now;
    return;
  }

  const previousElapsedSeconds = Math.max(
    0,
    (challengeModeDrift.lastAppliedAt - challengeModeDrift.startedAt) /
      1000,
  );
  const currentElapsedSeconds = Math.max(
    0,
    (appliedUntil - challengeModeDrift.startedAt) / 1000,
  );
  const driftDistanceRatio = getChallengeModeDriftSpeedIntegral({
    startSeconds: previousElapsedSeconds,
    endSeconds: currentElapsedSeconds,
  });

  cameraSurfaceY += stageSize.height * driftDistanceRatio;
  challengeModeDrift.lastAppliedAt = now;
  syncPlatforms();
};

const isChallengeModeFallDeathPhase = () =>
  game.phase === "ready" || game.phase === "charging";

const maybeTriggerChallengeModeFallDeath = (now) => {
  if (!isChallengeMode() || !isChallengeModeFallDeathPhase()) {
    return false;
  }

  if (getPlatformAnchor(game.current).surfaceY > getBottomSpikeHitSurfaceY()) {
    return false;
  }

  enterChallengeModeGameOver({ now });
  return true;
};

const getChargePowerForLift = (lift) => {
  const minLift = stageSize.height * CHARGE_MIN_LIFT_RATIO;
  const maxLift = stageSize.height * CHARGE_MAX_LIFT_RATIO;
  const liftRange = maxLift - minLift;

  return liftRange > 0 ? (lift - minLift) / liftRange : 1;
};

const setArms = (leftArm, rightArm, degrees) => {
  leftArm.setAttribute(
    "transform",
    `rotate(${-degrees} ${ARM_PIVOTS.left.x} ${ARM_PIVOTS.left.y})`,
  );
  rightArm.setAttribute(
    "transform",
    `rotate(${degrees} ${ARM_PIVOTS.right.x} ${ARM_PIVOTS.right.y})`,
  );
};

const syncSmearTrailDirection = (trailDirectionY) => {
  const maskDirection = trailDirectionY === "up" ? "top" : "bottom";
  const maskImage = `linear-gradient(to ${maskDirection}, #000 0%, #000 34%, transparent 100%)`;

  clawdSmear.style.transformOrigin =
    trailDirectionY === "up" ? "center bottom" : "center top";
  clawdSmear.style.webkitMaskImage = maskImage;
  clawdSmear.style.maskImage = maskImage;
};

const syncMascotSize = () => {
  clawdSize.height = Math.round(
    clamp(
      Math.min(stageSize.width, stageSize.height) * CLAWD_HEIGHT_RATIO,
      MIN_CLAWD_HEIGHT,
      MAX_CLAWD_HEIGHT,
    ) * CLAWD_SCENE_SCALE,
  );
  clawdSize.width = clawdSize.height * CLAWD_ASPECT_RATIO;
  clawdSize.topPadding = Math.round(
    clawdSize.height * CLAWD_TOP_PADDING_RATIO,
  );
  clawdSize.bottomPadding = Math.round(
    clawdSize.height * CLAWD_BOTTOM_PADDING_RATIO,
  );

  [clawdBody, clawdSmear].forEach((element) => {
    element.style.width = `${clawdSize.width}px`;
    element.style.height = `${clawdSize.height}px`;
  });
};

const syncSpikes = () => {
  spikeHeight = Math.round(
    clamp(
      Math.min(stageSize.width, stageSize.height) * SPIKE_HEIGHT_RATIO,
      SPIKE_HEIGHT_MIN,
      SPIKE_HEIGHT_MAX,
    ),
  );

  const spikeWidth = Math.round(spikeHeight * SPIKE_WIDTH_TO_HEIGHT_RATIO);
  const strokeWidth = platformThickness;
  const baseY = strokeWidth / 2;
  const tipY = Math.max(baseY, spikeHeight - strokeWidth / 2);
  const triangleCount = Math.max(1, Math.round(stageSize.width / spikeWidth));
  const fittedSpikeWidth = stageSize.width / triangleCount;
  const path = Array.from({ length: triangleCount }, (_, index) => {
    const x = index * fittedSpikeWidth;
    return `M ${x} ${baseY} L ${x + fittedSpikeWidth} ${baseY} L ${
      x + fittedSpikeWidth / 2
    } ${tipY} Z`;
  }).join(" ");

  stage.style.setProperty("--spike-height", `${spikeHeight}px`);
  [
    { container: spikes, svg: spikesSvg, path: spikesPath },
    { container: bottomSpikes, svg: bottomSpikesSvg, path: bottomSpikesPath },
  ].forEach((spikeSet) => {
    spikeSet.svg.setAttribute(
      "viewBox",
      `0 0 ${stageSize.width} ${spikeHeight}`,
    );
    spikeSet.svg.setAttribute("width", `${stageSize.width}`);
    spikeSet.svg.setAttribute("height", `${spikeHeight}`);
    spikeSet.path.setAttribute("d", path);
    spikeSet.path.setAttribute("stroke-width", `${strokeWidth}`);
  });
};

const getMinPlatformWidth = () =>
  Math.max(64, Math.round(stageSize.width * PLATFORM_WIDTH_MIN_RATIO));

const getMaxPlatformWidth = () =>
  Math.max(
    getMinPlatformWidth() + 1,
    Math.round(stageSize.width * PLATFORM_WIDTH_MAX_RATIO),
  );

const getPlatformWidth = (id) =>
  platformWidths[id] || Math.round(stageSize.width * 0.26);

const setPlatformWidth = (id, width) => {
  platformWidths[id] = Math.round(
    clamp(width, getMinPlatformWidth(), getMaxPlatformWidth()),
  );
};

const setRandomPlatformWidth = (id) => {
  setPlatformWidth(
    id,
    getRandomBetween(getMinPlatformWidth(), getMaxPlatformWidth()),
  );
};

const getTargetHorizontalDistanceMinRatio = () =>
  isChallengeMode()
    ? CHALLENGE_TARGET_HORIZONTAL_DISTANCE_MIN_RATIO
    : TARGET_HORIZONTAL_DISTANCE_MIN_RATIO;

const getTargetHorizontalDistanceMaxRatio = () =>
  isChallengeMode()
    ? CHALLENGE_TARGET_HORIZONTAL_DISTANCE_MAX_RATIO
    : TARGET_HORIZONTAL_DISTANCE_MAX_RATIO;

const getTargetVerticalGapMinRatio = () =>
  isChallengeMode()
    ? CHALLENGE_TARGET_VERTICAL_GAP_MIN_RATIO
    : TARGET_VERTICAL_GAP_MIN_RATIO;

const getTargetVerticalGapMaxRatio = () =>
  isChallengeMode()
    ? CHALLENGE_TARGET_VERTICAL_GAP_MAX_RATIO
    : TARGET_VERTICAL_GAP_MAX_RATIO;

const syncPlatformSizes = () => {
  platformThickness = Math.max(
    3,
    Math.round(Math.min(stageSize.width, stageSize.height) * 0.004),
  );
  platformVisualThickness = Math.max(
    PLATFORM_VISUAL_THICKNESS_MIN,
    Math.round(platformThickness * PLATFORM_VISUAL_THICKNESS_MULTIPLIER),
  );

  Object.entries(platforms).forEach(([id, platform]) => {
    platform.style.width = `${getPlatformWidth(id)}px`;
    platform.style.height = `${Math.max(28, platformVisualThickness)}px`;
    platform.style.setProperty(
      "--platform-thickness",
      `${platformVisualThickness}px`,
    );
  });

  syncSpikes();
};

const getPlatformSurfaceBounds = () => ({
  min: stageSize.height * PLATFORM_SURFACE_MIN_RATIO + platformVisualThickness,
  max: stageSize.height * PLATFORM_SURFACE_MAX_RATIO,
});

const getCurrentSurfaceY = () => {
  const bounds = getPlatformSurfaceBounds();
  const surfaceRatio = isChallengeMode()
    ? CHALLENGE_CURRENT_SURFACE_RATIO
    : CURRENT_SURFACE_RATIO;

  return clamp(stageSize.height * surfaceRatio, bounds.min, bounds.max);
};

const getScreenSurfaceY = (worldSurfaceY) =>
  worldSurfaceY - cameraSurfaceY + getCurrentSurfaceY();

const getPlatformBounds = (id) => ({
  minX: 0,
  maxX: Math.max(0, stageSize.width - getPlatformWidth(id)),
});

const clampPlatformPosition = (id) => {
  const bounds = getPlatformBounds(id);
  platformPositions[id].x = clamp(
    platformPositions[id].x,
    bounds.minX,
    bounds.maxX,
  );
};

const syncPlatform = (id) => {
  const position = platformPositions[id];
  const screenTop = Math.round(
    stageSize.height - getScreenSurfaceY(position.surfaceY),
  );

  platforms[id].style.transform = `translate3d(${position.x}px, ${screenTop}px, 0)`;
  platforms[id].style.opacity =
    platformGenerated[id] && screenTop >= spikeHeight ? "1" : "0";
};

const syncPlatforms = () => {
  platformIds.forEach((id) => {
    clampPlatformPosition(id);
    syncPlatform(id);
  });
};

const getPlatformScreenSurfaceY = (id) =>
  getScreenSurfaceY(platformPositions[id].surfaceY);

const isPlatformVisibleOnStage = (id) => {
  const screenTop = stageSize.height - getPlatformScreenSurfaceY(id);

  return (
    platformGenerated[id] &&
    getPlatformWidth(id) > 0 &&
    screenTop >= spikeHeight &&
    screenTop <= stageSize.height
  );
};

const sortPlatformIdsByScreenHeight = (ids) =>
  [...ids].sort(
    (a, b) => getPlatformScreenSurfaceY(a) - getPlatformScreenSurfaceY(b),
  );

const syncQueueToLowestVisiblePlatform = () => {
  const generatedIds = platformIds.filter(
    (id) => platformGenerated[id] && getPlatformWidth(id) > 0,
  );
  const visibleIds = sortPlatformIdsByScreenHeight(
    generatedIds.filter(isPlatformVisibleOnStage),
  );
  const visibleIdSet = new Set(visibleIds);
  const hiddenGeneratedIds = sortPlatformIdsByScreenHeight(
    generatedIds.filter((id) => !visibleIdSet.has(id)),
  );
  const queuedIds = [...visibleIds, ...hiddenGeneratedIds];

  if (queuedIds.length < 2) {
    game.platformQueue = [...platformIds];
    syncQueuedPlatforms();
    placeInitialPlatforms();
    return;
  }

  const queuedIdSet = new Set(queuedIds);
  game.platformQueue = [
    ...queuedIds,
    ...platformIds.filter((id) => !queuedIdSet.has(id)),
  ];
  syncQueuedPlatforms();
};

const rescaleJumpStateProps = ({ widthScale, heightScale }) => {
  if (!game.jump?.jumpStateProps) {
    return;
  }

  const props = game.jump.jumpStateProps;
  props.startX *= widthScale;
  props.endX *= widthScale;
  props.startY *= heightScale;
  props.endY *= heightScale;
  props.highAirY *= heightScale;
  props.hangtimeLift *= heightScale;
  props.landingImpactReferenceSpeed =
    clawdSize.height * LANDING_IMPACT_REFERENCE_SPEED_RATIO;
  props.visibleClawdHeight = getVisibleClawdHeight();
  props.bodyCollisionHeight = getClawdBodyCollisionHeight();
};

const rescaleStageLayout = (previousStageSize) => {
  if (!previousStageSize.width || !previousStageSize.height) {
    return;
  }

  const widthScale = stageSize.width / previousStageSize.width;
  const heightScale = stageSize.height / previousStageSize.height;

  platformIds.forEach((id) => {
    if (platformWidths[id]) {
      setPlatformWidth(id, platformWidths[id] * widthScale);
    }

    platformPositions[id].x = Math.round(platformPositions[id].x * widthScale);
    platformPositions[id].surfaceY = Math.round(
      platformPositions[id].surfaceY * heightScale,
    );
  });

  cameraSurfaceY *= heightScale;

  if (game.jump?.cameraMove) {
    game.jump.cameraMove.startCameraSurfaceY *= heightScale;
    game.jump.cameraMove.endCameraSurfaceY *= heightScale;
  }

  if (typeof game.jump?.freezeCameraSurfaceOffset === "number") {
    game.jump.freezeCameraSurfaceOffset *= heightScale;
  }

  rescaleJumpStateProps({ widthScale, heightScale });
};

const resyncJumpCollisionFrame = () => {
  if (!game.jump?.jumpStateProps) {
    return;
  }

  if (game.jump.outcome === "top") {
    const topCollisionFrame = findTopCollisionFrame(game.jump.jumpStateProps, {
      getCameraSurfaceOffsetAtFrame: (frame) =>
        getPredictedChallengeJumpCameraOffset({
          startedAt: game.jump.startedAt,
          startFrame: game.jump.startFrame,
          frame,
        }),
    });

    if (topCollisionFrame === null) {
      return;
    }

    game.jump.freezeFrame = topCollisionFrame;
    game.jump.resolveFrame = topCollisionFrame + getTopDeathDurationFrames();
    return;
  }

  if (game.jump.outcome === "low") {
    game.jump.freezeFrame = BOTTOM_DEATH_COLLISION_FRAME;
    game.jump.resolveFrame =
      BOTTOM_DEATH_COLLISION_FRAME + BOTTOM_DEATH_DURATION_FRAMES;
  }
};

const getPlatformAnchor = (id) => {
  const position = platformPositions[id];
  return {
    x: position.x + getPlatformWidth(id) / 2,
    surfaceY: getScreenSurfaceY(position.surfaceY),
  };
};

const getPlatformWorldAnchor = (id) => {
  const position = platformPositions[id];
  return {
    x: position.x + getPlatformWidth(id) / 2,
    surfaceY: position.surfaceY,
  };
};

const syncChargeMeterPosition = ({ anchor }) => {
  const meterWidth = Math.round(
    clamp(clawdSize.width * CHARGE_METER_WIDTH_RATIO, 8, 18),
  );
  const meterHeight = Math.round(
    clamp(
      getVisibleClawdHeight() * CHARGE_METER_HEIGHT_RATIO,
      48,
      Math.max(48, stageSize.height * 0.32),
    ),
  );
  const meterGap = Math.round(
    clamp(clawdSize.width * CHARGE_METER_GAP_RATIO, 8, 22),
  );
  const maxLeft = Math.max(
    CHARGE_METER_STAGE_PADDING,
    stageSize.width - meterWidth - CHARGE_METER_STAGE_PADDING,
  );
  const maxBottom = Math.max(
    CHARGE_METER_STAGE_PADDING,
    stageSize.height - meterHeight - CHARGE_METER_STAGE_PADDING,
  );
  const clawdLeft = anchor.x - clawdSize.width / 2;
  const visibleClawdHeight = getVisibleClawdHeight();
  const left = clamp(
    Math.round(clawdLeft - meterGap - meterWidth),
    CHARGE_METER_STAGE_PADDING,
    maxLeft,
  );
  const bottom = clamp(
    Math.round(anchor.surfaceY + (visibleClawdHeight - meterHeight) / 2),
    CHARGE_METER_STAGE_PADDING,
    maxBottom,
  );

  chargeMeter.style.width = `${meterWidth}px`;
  chargeMeter.style.height = `${meterHeight}px`;
  chargeMeter.style.left = `${left}px`;
  chargeMeter.style.bottom = `${bottom}px`;
};

const syncControlsHintPosition = ({ anchor }) => {
  if (!isAwaitingFirstSpace || controlsHint.hidden) {
    return;
  }

  const stagePadding = 8;
  const hintGap = clamp(clawdSize.height * 0.08, 8, 16);
  const halfHintWidth = controlsHint.offsetWidth / 2;
  const maxLeft = Math.max(
    halfHintWidth + stagePadding,
    stageSize.width - halfHintWidth - stagePadding,
  );
  const maxBottom = Math.max(
    stagePadding,
    stageSize.height - spikeHeight - controlsHint.offsetHeight - stagePadding,
  );
  const left = clamp(
    anchor.x,
    halfHintWidth + stagePadding,
    maxLeft,
  );
  const bottom = clamp(
    anchor.surfaceY + getVisibleClawdHeight() + hintGap,
    stagePadding,
    maxBottom,
  );

  controlsHint.style.left = `${Math.round(left)}px`;
  controlsHint.style.bottom = `${Math.round(bottom)}px`;
};

const setPlatformCenterAndWorldSurface = ({ id, centerX, surfaceY }) => {
  platformPositions[id].x = Math.round(centerX - getPlatformWidth(id) / 2);
  platformPositions[id].surfaceY = Math.round(surfaceY);
  clampPlatformPosition(id);
  syncPlatform(id);
};

const syncQueuedPlatforms = () => {
  game.current = game.platformQueue[0];
  game.target = game.platformQueue[1];
};

const syncPlatformRoles = () => {
  Object.entries(platforms).forEach(([id, platform]) => {
    platform.classList.toggle("is-current", id === game.current);
    platform.classList.toggle("is-target", id === game.target);
  });
};

const getTargetDirections = ({ fromX, targetWidth, minDistance }) => {
  const minCenterX = targetWidth / 2;
  const maxCenterX = stageSize.width - targetWidth / 2;

  return [-1, 1].filter((direction) => {
    const available =
      direction < 0 ? fromX - minCenterX : maxCenterX - fromX;
    return available >= minDistance * 0.65;
  });
};

const generateNextPlatform = ({ id, fromId, preferredDirection = null }) => {
  const from = getPlatformWorldAnchor(fromId);
  setRandomPlatformWidth(id);
  syncPlatformSizes();
  platformGenerated[id] = true;

  const targetWidth = getPlatformWidth(id);
  const minCenterX = targetWidth / 2;
  const maxCenterX = stageSize.width - targetWidth / 2;
  const minDistance = stageSize.width * getTargetHorizontalDistanceMinRatio();
  const maxDistance = stageSize.width * getTargetHorizontalDistanceMaxRatio();
  const directions = getTargetDirections({
    fromX: from.x,
    targetWidth,
    minDistance,
  });
  let direction =
    preferredDirection && directions.includes(preferredDirection)
      ? preferredDirection
      : pickRandom(directions.length ? directions : [-1, 1]);
  let availableDistance =
    direction < 0 ? from.x - minCenterX : maxCenterX - from.x;

  if (availableDistance < minDistance * 0.5) {
    direction *= -1;
    availableDistance =
      direction < 0 ? from.x - minCenterX : maxCenterX - from.x;
  }

  const safeMaxDistance = Math.max(1, Math.min(maxDistance, availableDistance));
  const safeMinDistance = Math.min(minDistance, safeMaxDistance * 0.72);
  const distance = getRandomBetween(safeMinDistance, safeMaxDistance);
  const minVerticalGap = stageSize.height * getTargetVerticalGapMinRatio();
  const maxVerticalGap = Math.max(
    minVerticalGap + 1,
    stageSize.height * getTargetVerticalGapMaxRatio(),
  );
  const surfaceY =
    from.surfaceY + getRandomBetween(minVerticalGap, maxVerticalGap);

  setPlatformCenterAndWorldSurface({
    id,
    centerX: clamp(from.x + direction * distance, minCenterX, maxCenterX),
    surfaceY,
  });
};

const placeInitialPlatforms = () => {
  cameraSurfaceY = 0;

  platformIds.forEach((id) => {
    platformWidths[id] = 0;
    platformGenerated[id] = false;
    platforms[id].style.opacity = "0";
  });

  setPlatformWidth(game.current, stageSize.width * 0.28);
  platformGenerated[game.current] = true;
  syncPlatformSizes();
  setPlatformCenterAndWorldSurface({
    id: game.current,
    centerX: stageSize.width * 0.5,
    surfaceY: cameraSurfaceY,
  });
  platforms[game.current].style.opacity = "1";

  game.platformQueue.slice(1).forEach((id, index) => {
    generateNextPlatform({
      id,
      fromId: game.platformQueue[index],
      preferredDirection: index === 0 ? 1 : null,
    });
  });
};

const createJumpStateProps = ({ start, end, highAirY }) => {
  const visibleClawdHeight = getVisibleClawdHeight();

  return {
    startX: start.x,
    startY: start.surfaceY,
    endX: end.x,
    endY: end.surfaceY,
    highAirY,
    hangtimeLift: getJumpHangtimeLift(),
    landingImpactReferenceSpeed:
      clawdSize.height * LANDING_IMPACT_REFERENCE_SPEED_RATIO,
    visibleClawdHeight,
    bodyCollisionHeight: getClawdBodyCollisionHeight(),
  };
};

const CHARGE_CYCLE_ADVANCE_ITERATION_LIMIT = 64;
const CHARGE_FULL_SEARCH_STEPS = 18;

const getChallengeChargeCycleProgress = ({ cycleStartedAt, now }) => {
  const driftStartedAt = challengeModeDrift.startedAt || cycleStartedAt;
  const startSeconds = Math.max(0, (cycleStartedAt - driftStartedAt) / 1000);
  const endSeconds = Math.max(startSeconds, (now - driftStartedAt) / 1000);
  const driftIntegral = getChallengeModeDriftSpeedIntegral({
    startSeconds,
    endSeconds,
  });
  const initialSpeedRatio = Math.max(
    0.0001,
    CHALLENGE_MODE_DRIFT_INITIAL_SPEED_RATIO,
  );

  return (
    ((driftIntegral / initialSpeedRatio) *
      CHALLENGE_MODE_CHARGE_INITIAL_SPEED_MULTIPLIER) /
    (CHARGE_MAX_MS / 1000)
  );
};

const getChargeCycleProgress = ({ cycleStartedAt, now }) => {
  if (isChallengeMode()) {
    return getChallengeChargeCycleProgress({ cycleStartedAt, now });
  }

  return Math.max(0, now - cycleStartedAt) / CHARGE_MAX_MS;
};

const findChallengeChargeFullAt = ({ cycleStartedAt, now }) => {
  let low = cycleStartedAt;
  let high = now;

  for (let step = 0; step < CHARGE_FULL_SEARCH_STEPS; step += 1) {
    const midpoint = (low + high) / 2;
    const progress = getChallengeChargeCycleProgress({
      cycleStartedAt,
      now: midpoint,
    });

    if (progress >= 1) {
      high = midpoint;
    } else {
      low = midpoint;
    }
  }

  return high;
};

const getChargeFullAt = ({ cycleStartedAt, now }) =>
  isChallengeMode()
    ? findChallengeChargeFullAt({ cycleStartedAt, now })
    : cycleStartedAt + CHARGE_MAX_MS;

const getChargePower = (now) => {
  let cycleStartedAt = game.chargeCycleStartedAt || game.chargeStartedAt || now;

  for (
    let iteration = 0;
    iteration < CHARGE_CYCLE_ADVANCE_ITERATION_LIMIT;
    iteration += 1
  ) {
    const progress = getChargeCycleProgress({ cycleStartedAt, now });

    if (progress < 1) {
      game.chargeCycleStartedAt = cycleStartedAt;
      return clamp01(progress);
    }

    const fullAt = getChargeFullAt({ cycleStartedAt, now });
    const holdEndsAt = fullAt + CHARGE_FULL_HOLD_MS;

    if (now < holdEndsAt) {
      game.chargeCycleStartedAt = cycleStartedAt;
      return 1;
    }

    cycleStartedAt = holdEndsAt;
  }

  game.chargeCycleStartedAt = now;
  return 0;
};

const getChargeFeedback = (power) => {
  if (!stageSize.height) {
    return "low";
  }

  const start = getPlatformAnchor(game.current);
  const target = getPlatformAnchor(game.target);
  const targetLift = target.surfaceY - start.surfaceY;
  const clearPower = getChargePowerForLift(targetLift);
  const topSurfaceY =
    getSpikeTipSurfaceY() -
    getJumpHangtimeLift() -
    getClawdBodyCollisionHeight();
  const topPower = getChargePowerForLift(topSurfaceY - start.surfaceY);
  const topDeathPower = clamp01(topPower);
  const hasTopDeath = topPower <= 1;

  if (hasTopDeath && power >= topDeathPower) {
    return "top";
  }

  const safeStartPower = clamp01(clearPower);

  if (power < safeStartPower) {
    return "low";
  }

  const safeEndPower = hasTopDeath ? topDeathPower : 1;
  const perfectEndPower = clamp(
    getChargePowerForLift(
      targetLift + stageSize.height * CHARGE_PERFECT_CLEARANCE_RATIO,
    ),
    safeStartPower,
    Math.max(safeStartPower, safeEndPower),
  );

  return power <= perfectEndPower ? "perfect" : "high";
};

const getChargeColor = (feedback) => {
  switch (feedback) {
    case "perfect":
      return CHARGE_COLOR_PERFECT;
    case "high":
      return CHARGE_COLOR_HIGH;
    case "top":
      return CHARGE_COLOR_TOP;
    case "low":
    default:
      return CHARGE_COLOR_LOW;
  }
};

const findTopCollisionFrame = (
  jumpStateProps,
  { getCameraSurfaceOffsetAtFrame = () => 0 } = {},
) => {
  const spikeTipY = getSpikeTipSurfaceY();
  let previousFrame = 0;
  let previousTopY = null;

  for (let frame = 0; frame <= CYCLE_DURATION_FRAMES; frame += 0.25) {
    const motion = getClawdJumpState({
      ...jumpStateProps,
      frame,
      fps: BASELINE_ANIMATION_FPS,
    });
    const bodyTopY = getClawdBodyTopY(
      motion,
      jumpStateProps.bodyCollisionHeight,
    ) - getCameraSurfaceOffsetAtFrame(frame);

    if (bodyTopY >= spikeTipY) {
      if (previousTopY === null || bodyTopY === previousTopY) {
        return frame;
      }

      const hitProgress = clamp01(
        (spikeTipY - previousTopY) / (bodyTopY - previousTopY),
      );
      return lerp(previousFrame, frame, hitProgress);
    }

    previousFrame = frame;
    previousTopY = bodyTopY;
  }

  return null;
};

const getTopDeathDurationFrames = () =>
  isChallengeMode() ? TOP_DEATH_IMPACT_HOLD_FRAMES : TOP_DEATH_DURATION_FRAMES;

const createJump = ({ now, chargePower }) => {
  const start = getPlatformAnchor(game.current);
  const target = getPlatformAnchor(game.target);
  const targetWorld = getPlatformWorldAnchor(game.target);
  const highAirY = start.surfaceY + getJumpLift(chargePower);
  const clearsTarget = highAirY >= target.surfaceY;
  const getCameraSurfaceOffsetAtFrame = (frame) =>
    getPredictedChallengeJumpCameraOffset({
      startedAt: now,
      startFrame: JUMP_RELEASE_START_FRAME,
      frame,
    });
  const lowDeathTarget = {
    x: target.x,
    surfaceY:
      getBottomSpikeHitSurfaceY() +
      getCameraSurfaceOffsetAtFrame(BOTTOM_DEATH_COLLISION_FRAME),
  };
  const targetEnd = {
    x: target.x,
    surfaceY: target.surfaceY,
  };
  let jumpStateProps = createJumpStateProps({
    start,
    end: targetEnd,
    highAirY,
  });
  let topCollisionFrame = null;
  let outcome = "success";

  if (!clearsTarget) {
    jumpStateProps = createJumpStateProps({
      start,
      end: lowDeathTarget,
      highAirY,
    });
  }

  topCollisionFrame = findTopCollisionFrame(jumpStateProps, {
    getCameraSurfaceOffsetAtFrame,
  });
  outcome =
    topCollisionFrame !== null ? "top" : clearsTarget ? "success" : "low";

  const bottomCollisionFrame =
    outcome === "low" ? BOTTOM_DEATH_COLLISION_FRAME : null;
  const freezeFrame = topCollisionFrame ?? bottomCollisionFrame;

  return {
    startedAt: now,
    startFrame: JUMP_RELEASE_START_FRAME,
    startCameraSurfaceY: cameraSurfaceY,
    chargePower,
    outcome,
    cameraMove:
      outcome === "success" && !isChallengeMode()
        ? {
            startFrame: JUMP_CAMERA_START_FRAME,
            durationFrames: JUMP_CAMERA_DURATION_FRAMES,
            startCameraSurfaceY: cameraSurfaceY,
            endCameraSurfaceY: targetWorld.surfaceY,
          }
        : null,
    jumpStateProps,
    freezeFrame,
    resolveFrame:
      outcome === "top"
        ? topCollisionFrame + getTopDeathDurationFrames()
        : outcome === "low"
          ? bottomCollisionFrame + BOTTOM_DEATH_DURATION_FRAMES
        : CYCLE_DURATION_FRAMES,
  };
};

const setClawdHitState = (isHit) => {
  clawdBody.classList.toggle("is-hit", isHit);
};

const syncHud = () => {
  const chargeFeedback = getChargeFeedback(game.chargePower);
  const chargeStyleFeedback = isChallengeMode() ? "low" : chargeFeedback;

  scoreValue.textContent = `score: ${game.score}`;
  chargeFill.style.transform = `translateY(${(1 - game.chargePower) * 100}%)`;
  chargeFill.style.setProperty(
    "--charge-color",
    getChargeColor(chargeStyleFeedback),
  );
  chargeFill.classList.toggle("is-low", chargeStyleFeedback === "low");
  stage.classList.toggle("is-dead", game.phase === "dead");
  stage.classList.toggle("is-charging", game.phase === "charging");
  stage.classList.toggle("is-jumping", game.phase === "jumping");
  stage.classList.toggle("is-respawning", game.phase === "respawning");
  stage.classList.toggle("is-game-over", game.phase === "game-over");
};

const hideChallengeGameOver = () => {
  if (
    document.activeElement instanceof HTMLElement &&
    gameOverModal.contains(document.activeElement)
  ) {
    document.activeElement.blur();
  }

  gameOverModal.hidden = true;
};

const showChallengeGameOver = () => {
  finalScoreValue.textContent = String(game.score);
  rankState.highlightedEntryId = null;
  rankState.hasSubmittedCurrentScore = false;
  submitScoreButton.classList.remove("is-sent");
  submitScoreButton.textContent = "上榜👆";
  const savedName = localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
  if (savedName) {
    playerNameInput.value = savedName;
  }
  renderRankList();
  updateScoreSubmitState();
  gameOverModal.hidden = false;
  void loadRankEntries();

  requestAnimationFrame(() => {
    if (!gameOverModal.hidden) {
      playerNameInput.focus({ preventScroll: true });
    }
  });
};

const enterChallengeModeGameOver = ({ now }) => {
  game.phase = "game-over";
  game.chargePower = 0;
  game.respawnStartedAt = 0;
  resetChallengeModeDrift(now);
  syncHud();

  if (!game.jump) {
    renderReadyPose();
    setClawdHitState(true);
  }

  showChallengeGameOver();
};

const renderStaticPose = ({ anchor, scaleX = 1, scaleY = 1, armSwing = 0 }) => {
  const clawdBottom = anchor.surfaceY - clawdSize.bottomPadding * scaleY;

  setClawdHitState(false);
  clawdBody.style.left = `${anchor.x}px`;
  clawdBody.style.bottom = `${clawdBottom}px`;
  clawdBody.style.transform = `translateX(-50%) scale(${scaleX}, ${scaleY})`;
  clawdVelocity.style.transform = "none";
  clawdSmear.style.opacity = "0";
  syncChargeMeterPosition({ anchor });
  syncControlsHintPosition({ anchor });
  setArms(bodyLeftArm, bodyRightArm, armSwing);
};

const renderReadyPose = () => {
  renderStaticPose({
    anchor: getPlatformAnchor(game.current),
  });
};

const finishRespawn = () => {
  if (game.phase !== "respawning") {
    return;
  }

  game.phase = "ready";
  game.respawnStartedAt = 0;
  syncHud();
  renderReadyPose();
};

const renderRespawnPose = (now) => {
  renderReadyPose();

  if (now - game.respawnStartedAt >= RESPAWN_FLASH_DURATION_MS) {
    finishRespawn();
  }
};

const renderChargingPose = (now) => {
  game.chargePower = getChargePower(now);
  const squash = easeOutQuart(game.chargePower);
  renderStaticPose({
    anchor: getPlatformAnchor(game.current),
    scaleX: lerp(1, ANTICIPATION_SCALE_X + 0.08, squash),
    scaleY: lerp(1, 0.56, squash),
    armSwing: lerp(0, ARM_TAKEOFF_DOWN_SWING_DEGREES, squash),
  });
  syncHud();
};

const BOTTOM_DEATH_TILT_START_FALL_PROGRESS = 2 / 5;

const getBottomDeathTiltDegrees = ({ frame, collisionFrame, jumpStateProps }) => {
  if (typeof collisionFrame !== "number") {
    return 0;
  }

  const tiltStartFrame = lerp(
    BOTTOM_DEATH_TILT_START_FRAME,
    collisionFrame,
    BOTTOM_DEATH_TILT_START_FALL_PROGRESS,
  );
  const fallProgress = clamp01(
    (frame - tiltStartFrame) / Math.max(1, collisionFrame - tiltStartFrame),
  );
  const jumpDirection =
    Math.sign(jumpStateProps.endX - jumpStateProps.startX) || 1;

  return (
    BOTTOM_DEATH_FALL_TILT_DEGREES *
    jumpDirection *
    easeOutQuart(fallProgress)
  );
};

const getBottomDeathMotionFrame = ({ frame, collisionFrame }) => {
  const fallProgress = clamp01(
    (frame - BOTTOM_DEATH_FALL_START_FRAME) /
      Math.max(1, collisionFrame - BOTTOM_DEATH_FALL_START_FRAME),
  );

  return lerp(
    BOTTOM_DEATH_FALL_START_FRAME,
    JUMP_CAMERA_START_FRAME,
    fallProgress,
  );
};

const renderJumpPose = (
  frame,
  jumpStateProps,
  {
    outcome = null,
    collisionFrame = null,
    cameraSurfaceOffset = 0,
    tiltFrame = frame,
  } = {},
) => {
  setClawdHitState(false);
  const bodyState = renderBodyLayer({
    frame,
    jumpStateProps,
    cameraSurfaceOffset,
    tiltDegrees:
      outcome === "low"
        ? getBottomDeathTiltDegrees({
            frame: tiltFrame,
            collisionFrame,
            jumpStateProps,
          })
        : 0,
  });
  renderSmearLayer({
    ...bodyState,
    jumpStateProps,
  });
};

const renderTopDeathPose = ({
  collisionFrame,
  deathFrame,
  jumpStateProps,
  cameraSurfaceOffset = 0,
  fallEnabled = true,
}) => {
  const collisionMotion = getClawdJumpState({
    ...jumpStateProps,
    frame: collisionFrame,
    fps: BASELINE_ANIMATION_FPS,
  });
  const collisionArmSwingDegrees = getClawdArmSwingDegrees({
    frame: collisionFrame,
    fps: BASELINE_ANIMATION_FPS,
    jumpStateProps,
    clawdMotion: collisionMotion,
  });
  const fallProgress = fallEnabled
    ? clamp01(
        (deathFrame - TOP_DEATH_IMPACT_HOLD_FRAMES) / TOP_DEATH_FALL_FRAMES,
      )
    : 0;
  const fallDistance =
    stageSize.height * TOP_DEATH_FALL_DISTANCE_RATIO * Math.pow(fallProgress, 2);
  const jumpDirection =
    Math.sign(jumpStateProps.endX - jumpStateProps.startX) || 1;
  const tiltDegrees = TOP_DEATH_FALL_TILT_DEGREES * jumpDirection * fallProgress;
  const scaleX = lerp(collisionMotion.scaleX, 0.94, fallProgress);
  const scaleY = lerp(collisionMotion.scaleY, 1.08, fallProgress);
  const surfaceY = collisionMotion.surfaceY - cameraSurfaceOffset - fallDistance;
  const clawdBottom = surfaceY - clawdSize.bottomPadding * scaleY;

  setClawdHitState(true);
  clawdBody.style.left = `${collisionMotion.centerX}px`;
  clawdBody.style.bottom = `${clawdBottom}px`;
  clawdBody.style.transform =
    `translateX(-50%) rotate(${tiltDegrees}deg) scale(${scaleX}, ${scaleY})`;
  clawdVelocity.style.transform = "none";
  clawdSmear.style.opacity = "0";
  setArms(
    bodyLeftArm,
    bodyRightArm,
    lerp(collisionArmSwingDegrees, ARM_MAX_UP_SWING_DEGREES, fallProgress),
  );
};

const renderBottomDeathPose = ({
  collisionFrame,
  jumpStateProps,
  motionFrame = collisionFrame,
}) => {
  const collisionMotion = getClawdJumpState({
    ...jumpStateProps,
    frame: motionFrame,
    fps: BASELINE_ANIMATION_FPS,
  });
  const collisionArmSwingDegrees = getClawdArmSwingDegrees({
    frame: motionFrame,
    fps: BASELINE_ANIMATION_FPS,
    jumpStateProps,
    clawdMotion: collisionMotion,
  });
  const clawdBottom =
    getBottomSpikeCollisionSurfaceY() -
    clawdSize.bottomPadding * collisionMotion.scaleY;
  const tiltDegrees = getBottomDeathTiltDegrees({
    frame: collisionFrame,
    collisionFrame,
    jumpStateProps,
  });

  setClawdHitState(true);
  clawdBody.style.left = `${collisionMotion.centerX}px`;
  clawdBody.style.bottom = `${clawdBottom}px`;
  clawdBody.style.transform = `translateX(-50%) rotate(${tiltDegrees}deg) scale(${collisionMotion.scaleX}, ${collisionMotion.scaleY})`;
  clawdVelocity.style.transform = "none";
  clawdSmear.style.opacity = "0";
  setArms(bodyLeftArm, bodyRightArm, collisionArmSwingDegrees);
};

const syncJumpCamera = ({ jump, frame }) => {
  const cameraMove = jump.cameraMove;
  const startCameraSurfaceY =
    jump.startCameraSurfaceY ?? cameraMove?.startCameraSurfaceY ?? cameraSurfaceY;

  if (!cameraMove) {
    return cameraSurfaceY - startCameraSurfaceY;
  }

  const progress = getJumpCameraProgress(
    (frame - cameraMove.startFrame) /
      Math.max(1, cameraMove.durationFrames),
  );
  cameraSurfaceY = lerp(
    cameraMove.startCameraSurfaceY,
    cameraMove.endCameraSurfaceY,
    progress,
  );
  syncPlatforms();

  return cameraSurfaceY - startCameraSurfaceY;
};

const getJumpFreezeCameraSurfaceOffset = ({ jump, cameraSurfaceOffset }) => {
  if (typeof jump.freezeCameraSurfaceOffset !== "number") {
    jump.freezeCameraSurfaceOffset = cameraSurfaceOffset;
  }

  return jump.freezeCameraSurfaceOffset;
};

const getJumpScreenBodyBottomY = ({ jump, frame, cameraSurfaceOffset }) => {
  const motion = getClawdJumpState({
    ...jump.jumpStateProps,
    frame,
    fps: BASELINE_ANIMATION_FPS,
  });

  return motion.surfaceY - cameraSurfaceOffset;
};

const isAutoPlayJumpSafe = ({ now, chargePower }) => {
  const jump = createJump({ now, chargePower });

  if (jump.outcome !== "success") {
    return false;
  }

  if (!isChallengeMode()) {
    return true;
  }

  for (
    let frame = jump.startFrame;
    frame <= jump.resolveFrame;
    frame += AUTO_PLAY_JUMP_SAMPLE_FRAME_STEP
  ) {
    const cameraSurfaceOffset = getPredictedChallengeJumpCameraOffset({
      startedAt: now,
      startFrame: jump.startFrame,
      frame,
    });

    if (
      getJumpScreenBodyBottomY({ jump, frame, cameraSurfaceOffset }) <=
      getBottomSpikeHitSurfaceY()
    ) {
      return false;
    }
  }

  return true;
};

const getAutoPlayChargePlan = (now) => {
  const start = getPlatformAnchor(game.current);
  const target = getPlatformAnchor(game.target);
  const targetLift = target.surfaceY - start.surfaceY;
  const clearPower = getChargePowerForLift(targetLift);
  const topSurfaceY =
    getSpikeTipSurfaceY() -
    getJumpHangtimeLift() -
    getClawdBodyCollisionHeight();
  const topPower = getChargePowerForLift(topSurfaceY - start.surfaceY);
  const safeStartPower = clamp(
    clearPower + AUTO_PLAY_SAFE_POWER_MARGIN,
    0,
    1,
  );
  const safeEndPower = clamp(
    topPower <= 1 ? topPower - AUTO_PLAY_SAFE_POWER_MARGIN : 1,
    0,
    1,
  );

  if (safeStartPower > safeEndPower) {
    return null;
  }

  const predictedLandingCameraOffset = getPredictedChallengeJumpCameraOffset({
    startedAt: now,
    startFrame: JUMP_RELEASE_START_FRAME,
    frame: CYCLE_DURATION_FRAMES,
  });
  const predictedLandingSurfaceY =
    target.surfaceY - predictedLandingCameraOffset;

  if (
    isChallengeMode() &&
    predictedLandingSurfaceY <=
      getBottomSpikeHitSurfaceY() + platformVisualThickness
  ) {
    return null;
  }

  const perfectEndPower = clamp(
    getChargePowerForLift(
      targetLift + stageSize.height * CHARGE_PERFECT_CLEARANCE_RATIO,
    ),
    safeStartPower,
    safeEndPower,
  );
  const preferredPower = clamp(
    (safeStartPower + perfectEndPower) / 2,
    safeStartPower,
    safeEndPower,
  );

  return {
    range: {
      start: safeStartPower,
      end: safeEndPower,
    },
    power: preferredPower,
  };
};

const maybeBeginAutoPlayCharge = (now) => {
  if (!autoPlayEnabled || !initialized || game.phase !== "ready") {
    return false;
  }

  const chargePlan = getAutoPlayChargePlan(now);

  if (chargePlan === null) {
    return false;
  }

  beginCharge(now);
  return true;
};

const maybeReleaseAutoPlayCharge = (now) => {
  if (!autoPlayEnabled || game.phase !== "charging") {
    return false;
  }

  game.chargePower = getChargePower(now);
  const chargePlan = getAutoPlayChargePlan(now);

  if (chargePlan === null) {
    return false;
  }

  const hasReachedTarget =
    game.chargePower + AUTO_PLAY_RELEASE_TOLERANCE >= chargePlan.power;
  const isInSafeRange =
    game.chargePower >= chargePlan.range.start - AUTO_PLAY_RELEASE_TOLERANCE &&
    game.chargePower <= chargePlan.range.end + AUTO_PLAY_RELEASE_TOLERANCE;

  if (!hasReachedTarget || !isInSafeRange) {
    return false;
  }

  if (!isAutoPlayJumpSafe({ now, chargePower: game.chargePower })) {
    return false;
  }

  releaseCharge(now);
  return true;
};

const maybeTriggerChallengeJumpFallDeath = ({
  now,
  jump,
  frame,
  cameraSurfaceOffset,
}) => {
  if (!isChallengeMode() || jump.outcome !== "success") {
    return false;
  }

  if (
    getJumpScreenBodyBottomY({ jump, frame, cameraSurfaceOffset }) >
    getBottomSpikeHitSurfaceY()
  ) {
    return false;
  }

  renderBottomDeathPose({
    collisionFrame: frame,
    jumpStateProps: jump.jumpStateProps,
  });
  enterChallengeModeGameOver({ now });
  return true;
};

const finishJump = (now) => {
  if (game.phase !== "jumping" || !game.jump) {
    return;
  }

  if (game.jump.outcome === "success") {
    const recycledPlatform = game.current;

    game.score += 1;
    if (!isChallengeMode()) {
      cameraSurfaceY = getPlatformWorldAnchor(game.target).surfaceY;
    }
    game.platformQueue = [...game.platformQueue.slice(1), recycledPlatform];
    syncQueuedPlatforms();
    platformGenerated[recycledPlatform] = false;
    platforms[recycledPlatform].style.opacity = "0";
    syncPlatforms();
    generateNextPlatform({
      id: recycledPlatform,
      fromId:
        game.platformQueue[game.platformQueue.length - 2] ?? game.current,
    });
    game.phase = "ready";
    game.chargePower = 0;
    game.jump = null;
    syncPlatformRoles();
    syncHud();
    renderReadyPose();
    return;
  }

  if (game.jump.outcome === "top" || game.jump.outcome === "low") {
    if (isChallengeMode()) {
      enterChallengeModeGameOver({ now });
      return;
    }

    resetGame({ preservePlatforms: true, respawn: true, now });
    return;
  }

  game.phase = "dead";
  game.chargePower = 0;
  syncHud();
};

const renderBodyLayer = ({
  frame,
  jumpStateProps,
  tiltDegrees = 0,
  cameraSurfaceOffset = 0,
}) => {
  const clawdMotion = getClawdJumpState({
    ...jumpStateProps,
    frame,
    fps: BASELINE_ANIMATION_FPS,
  });
  const velocityStretch = getVelocityStretch({
    frame,
    fps: BASELINE_ANIMATION_FPS,
    jumpStateProps,
  });
  const armSwingDegrees = getClawdArmSwingDegrees({
    frame,
    fps: BASELINE_ANIMATION_FPS,
    jumpStateProps,
    clawdMotion,
  });
  const screenSurfaceY = clawdMotion.surfaceY - cameraSurfaceOffset;
  const clawdBottom =
    screenSurfaceY - clawdSize.bottomPadding * clawdMotion.scaleY;

  clawdBody.style.left = `${clawdMotion.centerX}px`;
  clawdBody.style.bottom = `${clawdBottom}px`;
  clawdBody.style.transform = `translateX(-50%) rotate(${tiltDegrees}deg) scale(${clawdMotion.scaleX}, ${clawdMotion.scaleY})`;
  clawdVelocity.style.transform = `rotate(${velocityStretch.angleDegrees}deg) scale(${velocityStretch.alongScale}, ${velocityStretch.acrossScale}) rotate(${-velocityStretch.angleDegrees}deg)`;
  setArms(bodyLeftArm, bodyRightArm, armSwingDegrees);

  return { clawdMotion, armSwingDegrees, clawdBottom, velocityStretch };
};

const renderSmearLayer = ({
  clawdMotion,
  armSwingDegrees,
  clawdBottom,
  jumpStateProps,
  velocityStretch,
}) => {
  const speedFactors = getTakeoffSmearSpeedFactors({
    speed: velocityStretch?.speed ?? 0,
    visibleClawdHeight: jumpStateProps.visibleClawdHeight,
  });
  const visibleIntensity =
    clawdMotion.takeoffSmearIntensity * speedFactors.visibleFactor;
  const shapeIntensity =
    clawdMotion.takeoffSmearIntensity * speedFactors.shapeFactor;
  const smearOpacity = TAKEOFF_SMEAR_MAX_OPACITY * visibleIntensity;

  if (visibleIntensity <= 0) {
    clawdSmear.style.opacity = "0";
    return;
  }

  const smearScaleX = lerp(1, 0.92, shapeIntensity);
  const smearScaleY =
    clawdMotion.scaleY + TAKEOFF_SMEAR_MAX_EXTRA_SCALE_Y * shapeIntensity;
  const trailDirectionY = getSmearTrailDirectionY(jumpStateProps);
  const smearSkewX = getSmearSkewDegrees({
    ...jumpStateProps,
    trailDirectionY,
    intensity: shapeIntensity,
  });

  syncSmearTrailDirection(trailDirectionY);
  clawdSmear.style.left = `${clawdMotion.centerX}px`;
  clawdSmear.style.bottom = `${clawdBottom}px`;
  clawdSmear.style.opacity = `${smearOpacity}`;
  clawdSmear.style.transform = `translateX(-50%) skewX(${smearSkewX}deg) scale(${smearScaleX}, ${smearScaleY})`;
  setArms(smearLeftArm, smearRightArm, armSwingDegrees);
};

const renderFrame = (now) => {
  if (!initialized) {
    return;
  }

  if (isAwaitingFirstSpace) {
    renderReadyPose();
    return;
  }

  applyChallengeModeDrift(now);

  if (maybeTriggerChallengeModeFallDeath(now)) {
    return;
  }

  if (game.phase === "game-over") {
    return;
  }

  if (maybeBeginAutoPlayCharge(now)) {
    return;
  }

  if (game.phase === "respawning") {
    renderRespawnPose(now);
    return;
  }

  if (maybeReleaseAutoPlayCharge(now)) {
    return;
  }

  if (game.phase === "charging") {
    renderChargingPose(now);
    return;
  }

  if (game.phase === "jumping" && game.jump) {
    const elapsedFrame = getJumpElapsedFrame({ jump: game.jump, now });
    const frame = Math.min(elapsedFrame, CYCLE_DURATION_FRAMES);
    const cameraSurfaceOffset = syncJumpCamera({
      jump: game.jump,
      frame: elapsedFrame,
    });

    if (
      game.jump.outcome === "top" &&
      game.jump.freezeFrame !== null &&
      elapsedFrame >= game.jump.freezeFrame
    ) {
      const freezeCameraSurfaceOffset = getJumpFreezeCameraSurfaceOffset({
        jump: game.jump,
        cameraSurfaceOffset,
      });

      renderTopDeathPose({
        collisionFrame: game.jump.freezeFrame,
        deathFrame: elapsedFrame - game.jump.freezeFrame,
        jumpStateProps: game.jump.jumpStateProps,
        cameraSurfaceOffset: freezeCameraSurfaceOffset,
        fallEnabled: !isChallengeMode(),
      });

      if (elapsedFrame >= game.jump.resolveFrame) {
        finishJump(now);
      }
      return;
    }

    if (
      game.jump.outcome === "low" &&
      game.jump.freezeFrame !== null &&
      elapsedFrame >= game.jump.freezeFrame
    ) {
      renderBottomDeathPose({
        collisionFrame: game.jump.freezeFrame,
        jumpStateProps: game.jump.jumpStateProps,
        motionFrame: getBottomDeathMotionFrame({
          frame: game.jump.freezeFrame,
          collisionFrame: game.jump.freezeFrame,
        }),
      });

      if (elapsedFrame >= game.jump.resolveFrame) {
        finishJump(now);
      }
      return;
    }

    if (
      game.jump.outcome === "low" &&
      game.jump.freezeFrame !== null &&
      elapsedFrame >= BOTTOM_DEATH_FALL_START_FRAME
    ) {
      renderJumpPose(
        getBottomDeathMotionFrame({
          frame: elapsedFrame,
          collisionFrame: game.jump.freezeFrame,
        }),
        game.jump.jumpStateProps,
        {
          outcome: game.jump.outcome,
          collisionFrame: game.jump.freezeFrame,
          cameraSurfaceOffset,
          tiltFrame: elapsedFrame,
        },
      );
      return;
    }

    if (game.jump.outcome === "low") {
      renderJumpPose(frame, game.jump.jumpStateProps, {
        outcome: game.jump.outcome,
        collisionFrame: game.jump.freezeFrame,
        cameraSurfaceOffset,
      });
      return;
    }

    if (
      maybeTriggerChallengeJumpFallDeath({
        now,
        jump: game.jump,
        frame,
        cameraSurfaceOffset,
      })
    ) {
      return;
    }

    renderJumpPose(frame, game.jump.jumpStateProps, {
      outcome: game.jump.outcome,
      collisionFrame: game.jump.freezeFrame,
      cameraSurfaceOffset,
    });

    if (elapsedFrame >= game.jump.resolveFrame) {
      finishJump(now);
    }
    return;
  }

  if (game.phase === "dead" && game.jump) {
    const frame =
      game.jump.freezeFrame !== null
        ? game.jump.freezeFrame
        : CYCLE_DURATION_FRAMES;
    const cameraSurfaceOffset =
      game.jump.startCameraSurfaceY !== undefined
        ? cameraSurfaceY - game.jump.startCameraSurfaceY
        : 0;

    renderJumpPose(frame, game.jump.jumpStateProps, {
      cameraSurfaceOffset,
    });
    return;
  }

  renderReadyPose();
};

const tick = (now) => {
  renderFrame(now);
  frameRequest = requestAnimationFrame(tick);
};

const resetGame = ({
  preservePlatforms = false,
  respawn = false,
  now = performance.now(),
} = {}) => {
  hideChallengeGameOver();
  game.phase = respawn ? "respawning" : "ready";
  if (preservePlatforms) {
    syncQueueToLowestVisiblePlatform();
  } else {
    game.platformQueue = [...platformIds];
    syncQueuedPlatforms();
  }
  game.score = 0;
  game.chargeStartedAt = 0;
  game.chargeCycleStartedAt = 0;
  game.chargePower = 0;
  game.jump = null;
  game.respawnStartedAt = respawn ? now : 0;
  resetChallengeModeDrift(now);
  if (preservePlatforms) {
    syncPlatforms();
  } else {
    placeInitialPlatforms();
  }
  syncPlatformRoles();
  syncHud();
  renderReadyPose();
};

const updateStageSize = () => {
  const rect = getStageRect();
  const previousStageSize = stageSize;
  stageSize = {
    width: rect.width,
    height: rect.height,
  };

  if (!stageSize.width || !stageSize.height) {
    return;
  }

  syncMascotSize();
  if (!initialized) {
    initialized = true;
    resetGame();
    return;
  }

  rescaleStageLayout(previousStageSize);
  syncPlatformSizes();
  resyncJumpCollisionFrame();
  syncPlatforms();
  syncPlatformRoles();
  syncHud();
  renderFrame(performance.now());
};

const requestOverlayClose = () => {
  if (window.parent === window) {
    return;
  }

  window.parent.postMessage(
    {
      source: "jumping-clawd-game",
      type: "close-game",
    },
    "*",
  );
};

const syncAutoPlayUrl = () => {
  const url = new URL(window.location.href);

  if (autoPlayEnabled) {
    url.searchParams.set(AUTO_PLAY_SEARCH_PARAM, "1");
  } else {
    url.searchParams.delete(AUTO_PLAY_SEARCH_PARAM);
  }

  window.history.replaceState(null, "", url);
};

const postAutoPlayState = () => {
  if (window.parent === window) {
    return;
  }

  window.parent.postMessage(
    {
      source: "jumping-clawd-game",
      type: AUTO_PLAY_STATE_MESSAGE_TYPE,
      autoPlay: autoPlayEnabled,
    },
    "*",
  );
};

const setAutoPlayEnabled = (enabled) => {
  const nextAutoPlayEnabled = Boolean(enabled);

  if (autoPlayEnabled === nextAutoPlayEnabled) {
    postAutoPlayState();
    return;
  }

  autoPlayEnabled = nextAutoPlayEnabled;
  document.documentElement.dataset.autoPlay = String(autoPlayEnabled);
  syncAutoPlayUrl();
  postAutoPlayState();

  if (autoPlayEnabled && game.phase === "charging") {
    game.phase = "ready";
    game.chargeStartedAt = 0;
    game.chargeCycleStartedAt = 0;
    game.chargePower = 0;
    syncHud();
    renderReadyPose();
  }

  if (autoPlayEnabled) {
    maybeBeginAutoPlayCharge(performance.now());
  }
};

const toggleAutoPlay = () => {
  setAutoPlayEnabled(!autoPlayEnabled);
};

const isSpaceEvent = (event) => event.code === "Space" || event.key === " ";

const isAutoPlayToggleEvent = (event) =>
  event.ctrlKey &&
  !event.altKey &&
  !event.metaKey &&
  !event.shiftKey &&
  (event.code === "KeyA" || String(event.key).toLowerCase() === "a");

const isGameOverControlEvent = (event) =>
  game.phase === "game-over" &&
  event.target instanceof Node &&
  gameOverModal.contains(event.target);

const dismissControlsHint = (now) => {
  if (!initialized || !isAwaitingFirstSpace) {
    return;
  }

  isAwaitingFirstSpace = false;
  controlsHint.hidden = true;
  resetChallengeModeDrift(now);
};

const beginCharge = (now) => {
  if (!initialized || (game.phase !== "ready" && game.phase !== "dead")) {
    return;
  }

  if (game.phase === "dead") {
    resetGame({ preservePlatforms: true, now });
  }

  game.phase = "charging";
  game.chargeStartedAt = now;
  game.chargeCycleStartedAt = now;
  game.chargePower = 0;
  syncHud();
  renderChargingPose(now);
};

const releaseCharge = (now) => {
  if (game.phase !== "charging") {
    return;
  }

  applyChallengeModeDrift(now);
  game.chargePower = getChargePower(now);
  game.phase = "jumping";
  game.jump = createJump({
    now,
    chargePower: game.chargePower,
  });
  syncHud();
};

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    requestOverlayClose();
    return;
  }

  if (isAutoPlayToggleEvent(event) && !event.repeat) {
    event.preventDefault();
    event.stopPropagation();
    toggleAutoPlay();
    return;
  }

  if (isGameOverControlEvent(event)) {
    return;
  }

  if (!isSpaceEvent(event) || event.repeat) {
    return;
  }

  event.preventDefault();

  const now = performance.now();
  dismissControlsHint(now);

  if (autoPlayEnabled) {
    return;
  }

  beginCharge(now);
});

window.addEventListener("keyup", (event) => {
  if (isGameOverControlEvent(event)) {
    return;
  }

  if (!isSpaceEvent(event)) {
    return;
  }

  event.preventDefault();

  if (autoPlayEnabled) {
    return;
  }

  releaseCharge(performance.now());
});

window.addEventListener("message", (event) => {
  const message = event.data;

  if (
    !message ||
    typeof message !== "object" ||
    message.source !== "jumping-clawd-overlay" ||
    message.type !== AUTO_PLAY_TOGGLE_MESSAGE_TYPE
  ) {
    return;
  }

  toggleAutoPlay();
});

window.addEventListener("blur", () => {
  if (game.phase !== "charging") {
    return;
  }

  game.phase = "ready";
  game.chargeStartedAt = 0;
  game.chargeCycleStartedAt = 0;
  game.chargePower = 0;
  syncHud();
});

scoreForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitPlayerScore();
});

rankList.addEventListener("scroll", updateRankFade);

playerNameInput.addEventListener("input", () => {
  if (rankState.hasSubmittedCurrentScore) {
    updateScoreSubmitState();
    return;
  }

  submitScoreButton.classList.remove("is-sent");
  submitScoreButton.textContent = "上榜👆";
  updateScoreSubmitState();
});

retryGameButton.addEventListener("click", () => {
  resetGame({ now: performance.now() });
});

exitGameButton.addEventListener("click", () => {
  requestOverlayClose();
});

const resizeObserver = new ResizeObserver(updateStageSize);
resizeObserver.observe(stage);

updateStageSize();
renderFrame(performance.now());
syncAutoPlayUrl();
postAutoPlayState();
prefetchLeaderboard();
frameRequest = requestAnimationFrame(tick);

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(frameRequest);
});

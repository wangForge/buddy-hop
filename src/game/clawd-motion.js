import {
  ANTICIPATION_DURATION_FRAMES,
  ANTICIPATION_SCALE_X,
  ANTICIPATION_SCALE_Y,
  ARM_ARC_CENTER_UP_SWING_DEGREES,
  ARM_DESCENT_LAG_PROGRESS,
  ARM_FULL_LANDING_IMPACT_RATIO,
  ARM_LANDING_DOWN_SWING_DEGREES,
  ARM_MAX_UP_SWING_DEGREES,
  ARM_REST_SWING_DEGREES,
  ARM_TAKEOFF_DOWN_SWING_DEGREES,
  ASCENT_DURATION_FRAMES,
  ASCENT_END_X_RATIO,
  BASELINE_ANIMATION_FPS,
  CLAWD_SCENE_SCALE,
  EXIT_ACCELERATION_POWER,
  EXIT_ACCELERATION_START_PROGRESS,
  FAST_SEGMENT_SPEED_RATIO,
  HANGTIME_ARC_LENGTH_SAMPLES,
  HANGTIME_ARC_PROGRESS_SEARCH_STEPS,
  HANGTIME_DURATION_FRAMES,
  HANGTIME_END_X_RATIO,
  HANGTIME_SPEED_SAMPLE_PROGRESS,
  INTRO_HOLD_FRAMES,
  LANDING_IMPACT_FALLBACK_REFERENCE_SPEED,
  LANDING_IMPACT_MAX_RATIO,
  LANDING_IMPACT_MIN_RATIO,
  LANDING_MAX_SCALE_X,
  LANDING_MIN_SCALE_Y,
  LANDING_RECOVERY_DURATION_FRAMES,
  LANDING_SCALE_X,
  LANDING_SCALE_Y,
  LANDING_SQUASH_DURATION_FRAMES,
  LOW_CLEARANCE_ASCENT_END_X_RATIO,
  LOW_CLEARANCE_BLEND_OUT_MULTIPLIER,
  LOW_CLEARANCE_FULL_HEIGHT_MAX,
  LOW_CLEARANCE_FULL_HEIGHT_MIN,
  LOW_CLEARANCE_FULL_HEIGHT_RATIO,
  LOW_CLEARANCE_HANGTIME_END_X_RATIO,
  MIN_CLAWD_HEIGHT,
  SLOW_MOTION_SPEED_RATIO,
  SMEAR_VERTICAL_DIRECTION_EPSILON,
  SQUAT_RELEASE_FRAMES,
  TAKEOFF_SMEAR_DURATION_FRAMES,
  TAKEOFF_SMEAR_MAX_SKEW_DEGREES,
  TAKEOFF_SMEAR_SHAPE_FULL_SPEED_RATIO,
  TAKEOFF_SMEAR_SHAPE_MIN_SPEED_RATIO,
  TAKEOFF_SMEAR_SHAPE_SPEED_POWER,
  TAKEOFF_SMEAR_VISIBLE_FULL_SPEED_RATIO,
  TAKEOFF_SMEAR_VISIBLE_MIN_SPEED_RATIO,
  TAKEOFF_SMEAR_VISIBLE_SPEED_POWER,
  VELOCITY_SAMPLE_OFFSET_FRAMES,
  VELOCITY_STRETCH_FULL_SPEED,
  VELOCITY_STRETCH_MAX_ACROSS_SQUASH,
  VELOCITY_STRETCH_MAX_ALONG_SCALE,
  VELOCITY_STRETCH_MIN_SPEED,
  getClawdJumpTimingFrames,
} from "./config.js";
import {
  clamp,
  clamp01,
  easeInPowerWithInitialVelocity,
  easeOutQuart,
  getDistance,
  getEaseInPowerVelocity,
  getProgressBetweenValues,
  getRemappedProgress,
  getVelocityToward,
  lerp,
  resolvePositiveNumber,
} from "./math.js";

const getArcBump = (progress) => {
  const p = clamp01(progress);
  return 64 * Math.pow(p, 3) * Math.pow(1 - p, 3);
};

const getExitAccelerationProgress = ({
  animationFrame,
  accelerationStartFrame,
  landingFrame,
  initialSpeedRatio,
}) =>
  easeInPowerWithInitialVelocity({
    progress:
      (animationFrame - accelerationStartFrame) /
      (landingFrame - accelerationStartFrame),
    initialVelocityRatio: initialSpeedRatio,
    power: EXIT_ACCELERATION_POWER,
  });

const getExitSpeedAtProgress = ({
  progress,
  initialSpeedRatio,
  exitTotalDistance,
  exitDurationFrames,
}) =>
  (exitTotalDistance / Math.max(0.0001, exitDurationFrames)) *
  getEaseInPowerVelocity({
    progress,
    initialVelocityRatio: initialSpeedRatio,
    power: EXIT_ACCELERATION_POWER,
  });

const getAdaptiveApexXRatios = ({ highAirY, endY, visibleClawdHeight }) => {
  const referenceHeight = resolvePositiveNumber(
    visibleClawdHeight,
    MIN_CLAWD_HEIGHT * CLAWD_SCENE_SCALE,
  );
  const fullClearanceHeight = clamp(
    referenceHeight * LOW_CLEARANCE_FULL_HEIGHT_RATIO,
    LOW_CLEARANCE_FULL_HEIGHT_MIN,
    LOW_CLEARANCE_FULL_HEIGHT_MAX,
  );
  const clearance = Math.max(0, highAirY - endY);
  const lowClearanceIntensity =
    1 -
    getProgressBetweenValues({
      value: clearance,
      start: fullClearanceHeight,
      end: fullClearanceHeight * LOW_CLEARANCE_BLEND_OUT_MULTIPLIER,
    });

  return {
    ascentEnd: lerp(
      ASCENT_END_X_RATIO,
      LOW_CLEARANCE_ASCENT_END_X_RATIO,
      lowClearanceIntensity,
    ),
    hangtimeEnd: lerp(
      HANGTIME_END_X_RATIO,
      LOW_CLEARANCE_HANGTIME_END_X_RATIO,
      lowClearanceIntensity,
    ),
  };
};

export const getRenderFrameFromAnimationFrame = ({ animationFrame, fps }) => {
  const safeFps = resolvePositiveNumber(fps, BASELINE_ANIMATION_FPS);
  return (
    ((animationFrame + INTRO_HOLD_FRAMES) * safeFps) / BASELINE_ANIMATION_FPS
  );
};

const getQuinticHermiteValue = ({
  progress,
  duration,
  startValue,
  endValue,
  startVelocity,
  endVelocity,
}) => {
  const p = clamp01(progress);
  const startSlope = startVelocity * duration;
  const endSlope = endVelocity * duration;
  const remainingDistance = endValue - startValue - startSlope;
  const remainingSlope = endSlope - startSlope;
  const c3 = 10 * remainingDistance - 4 * remainingSlope;
  const c4 = -15 * remainingDistance + 7 * remainingSlope;
  const c5 = 6 * remainingDistance - 3 * remainingSlope;

  return (
    startValue +
    startSlope * p +
    c3 * Math.pow(p, 3) +
    c4 * Math.pow(p, 4) +
    c5 * Math.pow(p, 5)
  );
};

const getQuinticHermitePoint = ({
  frame,
  startFrame,
  duration,
  start,
  end,
  startVelocity,
  endVelocity,
}) => {
  const progress = (frame - startFrame) / duration;
  return {
    x: getQuinticHermiteValue({
      progress,
      duration,
      startValue: start.x,
      endValue: end.x,
      startVelocity: startVelocity.x,
      endVelocity: endVelocity.x,
    }),
    y: getQuinticHermiteValue({
      progress,
      duration,
      startValue: start.y,
      endValue: end.y,
      startVelocity: startVelocity.y,
      endVelocity: endVelocity.y,
    }),
  };
};

const getHangtimePosition = ({
  progress,
  duration,
  ascentEnd,
  hangtimeEnd,
  ascentSlowVelocity,
  descentSlowVelocity,
  hangtimeLift,
}) => {
  const safeProgress = clamp01(progress);
  const position = getQuinticHermitePoint({
    frame: safeProgress * duration,
    startFrame: 0,
    duration,
    start: ascentEnd,
    end: hangtimeEnd,
    startVelocity: ascentSlowVelocity,
    endVelocity: descentSlowVelocity,
  });

  return {
    x: position.x,
    y: position.y + getArcBump(safeProgress) * hangtimeLift,
  };
};

const getHangtimeArcLength = ({
  startProgress,
  endProgress,
  duration,
  ascentEnd,
  hangtimeEnd,
  ascentSlowVelocity,
  descentSlowVelocity,
  hangtimeLift,
  samples = HANGTIME_ARC_LENGTH_SAMPLES,
}) => {
  const from = clamp01(startProgress);
  const to = clamp01(endProgress);

  if (to <= from) {
    return 0;
  }

  const safeSamples = Math.max(1, Math.round(samples));
  let distance = 0;
  let previous = getHangtimePosition({
    progress: from,
    duration,
    ascentEnd,
    hangtimeEnd,
    ascentSlowVelocity,
    descentSlowVelocity,
    hangtimeLift,
  });

  for (let index = 1; index <= safeSamples; index += 1) {
    const current = getHangtimePosition({
      progress: lerp(from, to, index / safeSamples),
      duration,
      ascentEnd,
      hangtimeEnd,
      ascentSlowVelocity,
      descentSlowVelocity,
      hangtimeLift,
    });
    distance += getDistance(previous, current);
    previous = current;
  }

  return distance;
};

const getHangtimeProgressAtArcLength = ({
  targetDistance,
  startProgress,
  endProgress,
  arcLength,
  duration,
  ascentEnd,
  hangtimeEnd,
  ascentSlowVelocity,
  descentSlowVelocity,
  hangtimeLift,
}) => {
  if (targetDistance <= 0 || arcLength <= 0) {
    return clamp01(startProgress);
  }

  if (targetDistance >= arcLength) {
    return clamp01(endProgress);
  }

  let low = clamp01(startProgress);
  let high = clamp01(endProgress);

  for (let step = 0; step < HANGTIME_ARC_PROGRESS_SEARCH_STEPS; step += 1) {
    const mid = (low + high) / 2;
    const distance = getHangtimeArcLength({
      startProgress,
      endProgress: mid,
      duration,
      ascentEnd,
      hangtimeEnd,
      ascentSlowVelocity,
      descentSlowVelocity,
      hangtimeLift,
      samples: HANGTIME_ARC_LENGTH_SAMPLES,
    });

    if (distance < targetDistance) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
};

const getHangtimeSpeedAtProgress = ({
  progress,
  duration,
  ascentEnd,
  hangtimeEnd,
  ascentSlowVelocity,
  descentSlowVelocity,
  hangtimeLift,
}) => {
  const beforeProgress = clamp01(progress - HANGTIME_SPEED_SAMPLE_PROGRESS);
  const afterProgress = clamp01(progress + HANGTIME_SPEED_SAMPLE_PROGRESS);
  const progressSpan = Math.max(
    0.0001,
    (afterProgress - beforeProgress) * duration,
  );
  const before = getHangtimePosition({
    progress: beforeProgress,
    duration,
    ascentEnd,
    hangtimeEnd,
    ascentSlowVelocity,
    descentSlowVelocity,
    hangtimeLift,
  });
  const after = getHangtimePosition({
    progress: afterProgress,
    duration,
    ascentEnd,
    hangtimeEnd,
    ascentSlowVelocity,
    descentSlowVelocity,
    hangtimeLift,
  });

  return getDistance(before, after) / progressSpan;
};

const getExitAcceleratedPosition = ({
  animationFrame,
  accelerationStartFrame,
  landingFrame,
  initialSpeedRatio,
  exitArcLength,
  exitTotalDistance,
  duration,
  ascentEnd,
  hangtimeEnd,
  ascentSlowVelocity,
  descentSlowVelocity,
  hangtimeLift,
  end,
}) => {
  const distanceProgress = getExitAccelerationProgress({
    animationFrame,
    accelerationStartFrame,
    landingFrame,
    initialSpeedRatio,
  });
  const distance = exitTotalDistance * distanceProgress;

  if (distance < exitArcLength) {
    const progress = getHangtimeProgressAtArcLength({
      targetDistance: distance,
      startProgress: EXIT_ACCELERATION_START_PROGRESS,
      endProgress: 1,
      arcLength: exitArcLength,
      duration,
      ascentEnd,
      hangtimeEnd,
      ascentSlowVelocity,
      descentSlowVelocity,
      hangtimeLift,
    });

    return getHangtimePosition({
      progress,
      duration,
      ascentEnd,
      hangtimeEnd,
      ascentSlowVelocity,
      descentSlowVelocity,
      hangtimeLift,
    });
  }

  const descentProgress = getRemappedProgress({
    progress: distance,
    start: exitArcLength,
    end: exitTotalDistance,
  });

  return {
    x: lerp(hangtimeEnd.x, end.x, descentProgress),
    y: lerp(hangtimeEnd.y, end.y, descentProgress),
  };
};

const getLandingImpactRatio = ({ speed, referenceSpeed }) => {
  const safeReferenceSpeed = resolvePositiveNumber(
    referenceSpeed,
    LANDING_IMPACT_FALLBACK_REFERENCE_SPEED,
  );

  return clamp(
    speed / safeReferenceSpeed,
    LANDING_IMPACT_MIN_RATIO,
    LANDING_IMPACT_MAX_RATIO,
  );
};

const getLandingArmIntensity = (impactRatio) =>
  getProgressBetweenValues({
    value: impactRatio,
    start: LANDING_IMPACT_MIN_RATIO,
    end: ARM_FULL_LANDING_IMPACT_RATIO,
  });

const getLandingImpactScales = ({ speed, referenceSpeed }) => {
  const impactRatio = getLandingImpactRatio({ speed, referenceSpeed });

  return {
    scaleX: clamp(
      1 + (LANDING_SCALE_X - 1) * impactRatio,
      1,
      LANDING_MAX_SCALE_X,
    ),
    scaleY: clamp(
      1 - (1 - LANDING_SCALE_Y) * impactRatio,
      LANDING_MIN_SCALE_Y,
      1,
    ),
    impactRatio,
  };
};

const getAnimationFrame = ({ frame, fps }) => {
  const safeFrame =
    typeof frame === "number" && Number.isFinite(frame) ? Math.max(0, frame) : 0;
  const safeFps = resolvePositiveNumber(fps, BASELINE_ANIMATION_FPS);
  const baselineFrame = (safeFrame * BASELINE_ANIMATION_FPS) / safeFps;
  return Math.max(0, baselineFrame - INTRO_HOLD_FRAMES);
};

export const getClawdJumpState = ({
  frame,
  fps,
  startX,
  startY,
  endX,
  endY,
  highAirY,
  hangtimeLift,
  landingImpactReferenceSpeed,
  visibleClawdHeight,
}) => {
  const animationFrame = getAnimationFrame({ frame, fps });
  const {
    jumpStartFrame,
    ascentEndFrame,
    landingFrame,
    exitAccelerationStartFrame,
    landingSquashEndFrame,
    landingRecoveryEndFrame,
  } = getClawdJumpTimingFrames();
  const start = { x: startX, y: startY };
  const apexXRatios = getAdaptiveApexXRatios({
    highAirY,
    endY,
    visibleClawdHeight,
  });
  const ascentEnd = {
    x: lerp(startX, endX, apexXRatios.ascentEnd),
    y: highAirY,
  };
  const hangtimeEnd = {
    x: lerp(startX, endX, apexXRatios.hangtimeEnd),
    y: highAirY,
  };
  const end = { x: endX, y: endY };
  const ascentDistance = getDistance(start, ascentEnd);
  const descentDistance = getDistance(hangtimeEnd, end);
  const slowMotionSpeed =
    (getDistance(ascentEnd, hangtimeEnd) / HANGTIME_DURATION_FRAMES) *
    SLOW_MOTION_SPEED_RATIO;
  const ascentFastVelocity = getVelocityToward(
    start,
    ascentEnd,
    (ascentDistance / ASCENT_DURATION_FRAMES) * FAST_SEGMENT_SPEED_RATIO,
  );
  const ascentSlowVelocity = getVelocityToward(start, ascentEnd, slowMotionSpeed);
  const descentSlowVelocity = getVelocityToward(
    hangtimeEnd,
    end,
    slowMotionSpeed,
  );
  const takeoffSmearProgress = clamp01(
    (animationFrame - jumpStartFrame) / TAKEOFF_SMEAR_DURATION_FRAMES,
  );
  const takeoffSmearIntensity =
    animationFrame > jumpStartFrame &&
    animationFrame < jumpStartFrame + TAKEOFF_SMEAR_DURATION_FRAMES
      ? Math.sin(takeoffSmearProgress * Math.PI)
      : 0;
  const exitArcLength = getHangtimeArcLength({
    startProgress: EXIT_ACCELERATION_START_PROGRESS,
    endProgress: 1,
    duration: HANGTIME_DURATION_FRAMES,
    ascentEnd,
    hangtimeEnd,
    ascentSlowVelocity,
    descentSlowVelocity,
    hangtimeLift,
  });
  const exitTotalDistance = exitArcLength + descentDistance;
  const exitDurationFrames = landingFrame - exitAccelerationStartFrame;
  const exitInitialSpeed = getHangtimeSpeedAtProgress({
    progress: EXIT_ACCELERATION_START_PROGRESS,
    duration: HANGTIME_DURATION_FRAMES,
    ascentEnd,
    hangtimeEnd,
    ascentSlowVelocity,
    descentSlowVelocity,
    hangtimeLift,
  });
  const exitInitialSpeedRatio = clamp01(
    exitInitialSpeed / Math.max(0.0001, exitTotalDistance / exitDurationFrames),
  );
  const landingSpeed = getExitSpeedAtProgress({
    progress: 1,
    initialSpeedRatio: exitInitialSpeedRatio,
    exitTotalDistance,
    exitDurationFrames,
  });
  const landingImpactScales = getLandingImpactScales({
    speed: landingSpeed,
    referenceSpeed: landingImpactReferenceSpeed,
  });

  let centerX = startX;
  let surfaceY = startY;
  if (animationFrame >= landingFrame) {
    centerX = endX;
    surfaceY = endY;
  } else if (animationFrame >= exitAccelerationStartFrame) {
    const position = getExitAcceleratedPosition({
      animationFrame,
      accelerationStartFrame: exitAccelerationStartFrame,
      landingFrame,
      initialSpeedRatio: exitInitialSpeedRatio,
      exitArcLength,
      exitTotalDistance,
      duration: HANGTIME_DURATION_FRAMES,
      ascentEnd,
      hangtimeEnd,
      ascentSlowVelocity,
      descentSlowVelocity,
      hangtimeLift,
      end,
    });
    centerX = position.x;
    surfaceY = position.y;
  } else if (animationFrame >= ascentEndFrame) {
    const position = getHangtimePosition({
      progress: (animationFrame - ascentEndFrame) / HANGTIME_DURATION_FRAMES,
      duration: HANGTIME_DURATION_FRAMES,
      ascentEnd,
      hangtimeEnd,
      ascentSlowVelocity,
      descentSlowVelocity,
      hangtimeLift,
    });
    centerX = position.x;
    surfaceY = position.y;
  } else if (animationFrame >= jumpStartFrame) {
    const position = getQuinticHermitePoint({
      frame: animationFrame,
      startFrame: jumpStartFrame,
      duration: ASCENT_DURATION_FRAMES,
      start,
      end: ascentEnd,
      startVelocity: ascentFastVelocity,
      endVelocity: ascentSlowVelocity,
    });
    centerX = position.x;
    surfaceY = position.y;
  }

  let scaleX = 1;
  let scaleY = 1;
  if (animationFrame < ANTICIPATION_DURATION_FRAMES) {
    const progress = easeOutQuart(animationFrame / ANTICIPATION_DURATION_FRAMES);
    scaleX = lerp(1, ANTICIPATION_SCALE_X, progress);
    scaleY = lerp(1, ANTICIPATION_SCALE_Y, progress);
  } else if (animationFrame < jumpStartFrame) {
    scaleX = ANTICIPATION_SCALE_X;
    scaleY = ANTICIPATION_SCALE_Y;
  } else if (animationFrame < jumpStartFrame + SQUAT_RELEASE_FRAMES) {
    const progress =
      1 -
      easeOutQuart((animationFrame - jumpStartFrame) / SQUAT_RELEASE_FRAMES);
    scaleX = lerp(1, ANTICIPATION_SCALE_X, progress);
    scaleY = lerp(1, ANTICIPATION_SCALE_Y, progress);
  } else if (
    animationFrame >= landingFrame &&
    animationFrame < landingSquashEndFrame
  ) {
    const progress = easeOutQuart(
      (animationFrame - landingFrame) / LANDING_SQUASH_DURATION_FRAMES,
    );
    scaleX = lerp(1, landingImpactScales.scaleX, progress);
    scaleY = lerp(1, landingImpactScales.scaleY, progress);
  } else if (
    animationFrame >= landingSquashEndFrame &&
    animationFrame < landingRecoveryEndFrame
  ) {
    const progress =
      1 -
      easeOutQuart(
        (animationFrame - landingSquashEndFrame) /
          LANDING_RECOVERY_DURATION_FRAMES,
      );
    scaleX = lerp(1, landingImpactScales.scaleX, progress);
    scaleY = lerp(1, landingImpactScales.scaleY, progress);
  }

  return {
    centerX,
    surfaceY,
    scaleX,
    scaleY,
    landingImpactRatio: landingImpactScales.impactRatio,
    takeoffSmearIntensity,
  };
};

export const getClawdArmSwingDegrees = ({
  frame,
  fps,
  jumpStateProps,
  clawdMotion,
}) => {
  const safeFps = resolvePositiveNumber(fps, BASELINE_ANIMATION_FPS);
  const animationFrame = getAnimationFrame({ frame, fps: safeFps });
  const {
    jumpStartFrame,
    exitAccelerationStartFrame,
    landingFrame,
    landingRecoveryEndFrame,
  } = getClawdJumpTimingFrames();
  const currentMotion =
    clawdMotion ??
    getClawdJumpState({
      ...jumpStateProps,
      frame,
      fps: safeFps,
    });
  const arcCenterMotion = getClawdJumpState({
    ...jumpStateProps,
    frame: getRenderFrameFromAnimationFrame({
      animationFrame: exitAccelerationStartFrame,
      fps: safeFps,
    }),
    fps: safeFps,
  });
  const landingArmIntensity = getLandingArmIntensity(
    currentMotion.landingImpactRatio ?? ARM_FULL_LANDING_IMPACT_RATIO,
  );
  const maxUpSwingDegrees = lerp(
    ARM_ARC_CENTER_UP_SWING_DEGREES,
    ARM_MAX_UP_SWING_DEGREES,
    landingArmIntensity,
  );
  const landingDownSwingDegrees = lerp(
    ARM_REST_SWING_DEGREES,
    ARM_LANDING_DOWN_SWING_DEGREES,
    landingArmIntensity,
  );

  if (animationFrame < ANTICIPATION_DURATION_FRAMES) {
    const progress = easeOutQuart(animationFrame / ANTICIPATION_DURATION_FRAMES);
    return lerp(
      ARM_REST_SWING_DEGREES,
      ARM_TAKEOFF_DOWN_SWING_DEGREES,
      progress,
    );
  }

  if (animationFrame < jumpStartFrame) {
    return ARM_TAKEOFF_DOWN_SWING_DEGREES;
  }

  if (animationFrame < exitAccelerationStartFrame) {
    const progress = getProgressBetweenValues({
      value: currentMotion.surfaceY,
      start: jumpStateProps.startY,
      end: arcCenterMotion.surfaceY,
    });

    return lerp(
      ARM_TAKEOFF_DOWN_SWING_DEGREES,
      ARM_ARC_CENTER_UP_SWING_DEGREES,
      progress,
    );
  }

  if (animationFrame < landingFrame) {
    const descentProgress = getProgressBetweenValues({
      value: currentMotion.surfaceY,
      start: arcCenterMotion.surfaceY,
      end: jumpStateProps.endY,
    });

    if (descentProgress < ARM_DESCENT_LAG_PROGRESS) {
      return lerp(
        ARM_ARC_CENTER_UP_SWING_DEGREES,
        maxUpSwingDegrees,
        descentProgress / ARM_DESCENT_LAG_PROGRESS,
      );
    }

    const recoveryProgress = getRemappedProgress({
      progress: descentProgress,
      start: ARM_DESCENT_LAG_PROGRESS,
      end: 1,
    });

    return lerp(maxUpSwingDegrees, landingDownSwingDegrees, recoveryProgress);
  }

  if (animationFrame < landingRecoveryEndFrame) {
    const progress = easeOutQuart(
      (animationFrame - landingFrame) /
        (landingRecoveryEndFrame - landingFrame),
    );
    return lerp(landingDownSwingDegrees, ARM_REST_SWING_DEGREES, progress);
  }

  return ARM_REST_SWING_DEGREES;
};

export const getVelocityStretch = ({ frame, fps, jumpStateProps }) => {
  const safeFps = resolvePositiveNumber(fps, BASELINE_ANIMATION_FPS);
  const sampleOffset =
    (VELOCITY_SAMPLE_OFFSET_FRAMES * safeFps) / BASELINE_ANIMATION_FPS;
  const before = getClawdJumpState({
    ...jumpStateProps,
    frame: frame - sampleOffset,
    fps: safeFps,
  });
  const after = getClawdJumpState({
    ...jumpStateProps,
    frame: frame + sampleOffset,
    fps: safeFps,
  });
  const sampleSpan = VELOCITY_SAMPLE_OFFSET_FRAMES * 2;
  const velocityX = (after.centerX - before.centerX) / sampleSpan;
  const velocityY = (after.surfaceY - before.surfaceY) / sampleSpan;
  const speed = Math.hypot(velocityX, velocityY);
  const intensity = clamp01(
    (speed - VELOCITY_STRETCH_MIN_SPEED) /
      (VELOCITY_STRETCH_FULL_SPEED - VELOCITY_STRETCH_MIN_SPEED),
  );

  return {
    angleDegrees: (Math.atan2(-velocityY, velocityX) * 180) / Math.PI,
    alongScale: 1 + VELOCITY_STRETCH_MAX_ALONG_SCALE * intensity,
    acrossScale: 1 - VELOCITY_STRETCH_MAX_ACROSS_SQUASH * intensity,
    speed,
    intensity,
    velocityX,
    velocityY,
  };
};

export const getSmearTrailDirectionY = ({ startY, highAirY }) => {
  const takeoffVerticalDelta = highAirY - startY;

  if (Math.abs(takeoffVerticalDelta) < SMEAR_VERTICAL_DIRECTION_EPSILON) {
    return "down";
  }

  return takeoffVerticalDelta > 0 ? "down" : "up";
};

export const getSmearSkewDegrees = ({
  startX,
  endX,
  trailDirectionY,
  intensity,
}) => {
  const horizontalDirection = Math.sign(endX - startX) || 1;
  const trailXDirection = -horizontalDirection;
  const originDirection = trailDirectionY === "down" ? 1 : -1;

  return (
    Math.abs(TAKEOFF_SMEAR_MAX_SKEW_DEGREES) *
    trailXDirection *
    originDirection *
    intensity
  );
};

export const getTakeoffSmearSpeedFactors = ({ speed, visibleClawdHeight }) => {
  const referenceSpeed = resolvePositiveNumber(
    visibleClawdHeight,
    MIN_CLAWD_HEIGHT * CLAWD_SCENE_SCALE,
  );
  const speedRatio = Math.max(0, speed) / referenceSpeed;
  const visibleFactor = getProgressBetweenValues({
    value: speedRatio,
    start: TAKEOFF_SMEAR_VISIBLE_MIN_SPEED_RATIO,
    end: TAKEOFF_SMEAR_VISIBLE_FULL_SPEED_RATIO,
  });
  const shapeFactor = getProgressBetweenValues({
    value: speedRatio,
    start: TAKEOFF_SMEAR_SHAPE_MIN_SPEED_RATIO,
    end: TAKEOFF_SMEAR_SHAPE_FULL_SPEED_RATIO,
  });

  return {
    speedRatio,
    visibleFactor: Math.pow(visibleFactor, TAKEOFF_SMEAR_VISIBLE_SPEED_POWER),
    shapeFactor: Math.pow(shapeFactor, TAKEOFF_SMEAR_SHAPE_SPEED_POWER),
  };
};

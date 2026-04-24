'use strict';

// ============================================================
// CONFIG
// ============================================================
// Read config overrides from URL hash (used by dev.html)
let __hashCfg = null;
try {
    if (window.location.hash.length > 1) {
        __hashCfg = JSON.parse(decodeURIComponent(window.location.hash.slice(1)));
    }
} catch(e) {}

const CFG = __hashCfg || window.__DRIFT_CFG || {
    ARROW_SPEED: 3.5,
    STEER_RATE: 0.01,
    STEER_MAX: 0.035,
    GRIP: 0.025,
    REALIGN_RATE: 0.04,
    DRIFT_DRAG_EXP: 2,
    DRIFT_DRAG_SCALE: 0.008,
    ARROW_LENGTH: 22,
    ARROW_WIDTH: 9,
    TRACK_WIDTH: 170,
    MIN_TRACK_WIDTH: 65,
    BRAKE_DECEL: 0.085,
    BRAKE_MIN_SPEED: 0.5,
    SEGMENT_LENGTH: 12,
    LOOK_AHEAD: 120,
    LOOK_BEHIND: 100,
    SPEED_RECOVERY: 0.034,
    SPEED_RECOVERY_RELEASE: 0.06,
    DIFFICULTY_RAMP: 1.2E-4,
    METERS_PER_SEGMENT: 0.03,
    OVERLAP_MARGIN: 15,
    // Agent steering
    WANDER_WEIGHT: 1,
    WANDER_FREQUENCY: 0.08,
    WANDER_AMPLITUDE: 0.06,
    AVOIDANCE_WEIGHT: 3,
    AVOIDANCE_RADIUS: 500,
    RHYTHM_WEIGHT: 0.7,
    RHYTHM_FREQUENCY: 0.12,
    RHYTHM_AMPLITUDE: 0.04,
    EVENT_WEIGHT: 4,
    EVENT_INTENSITY: 0.1,
    EVENT_DECAY: 0.92,
    EVENT_INTERVAL_MIN: 15,
    EVENT_INTERVAL_MAX: 60,
    CENTERING_WEIGHT: 0.15,
    WIDTH_CURVATURE_COUPLING: 0.7,
    WIDTH_TRANSITION_RATE: 0.12,
    // Agent physics
    AGENT_STEER_RATE: 0.011,
    AGENT_STEER_MAX: 0.038,
    AGENT_GRIP: 0.03,
    // Track center offset from agent path
    OFFSET_FREQUENCY: 0.02,
    OFFSET_AMPLITUDE: 0.8,
    AGENT_MARGIN: 18,
    // Timer / tokens
    START_TIME: 30,
    TIME_TOKEN_VALUE: 3.5,
    TOKEN_RADIUS: 10,
    TOKEN_MIN_GAP: 25,
    TOKEN_SPAWN_CHANCE: 0.025,
    TOKEN_NO_SPAWN_ZONE: 40,
    // Hazards
    HAZARD_RADIUS: 10,
    HAZARD_EFFECT_DUR: 180,
    HAZARD_MIN_GAP: 10,
    HAZARD_SPAWN_CHANCE: 0.02,
    HAZARD_NO_SPAWN_ZONE: 80,
    HAZARD_SLOW_MULT: 0.55,
    HAZARD_SPEED_MULT: 1.12,
    DEATH_HAZARD_RADIUS: 5,
};

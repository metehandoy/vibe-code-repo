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
    STEER_RATE: 0.014,          // slightly slower rotation for less dizziness
    STEER_MAX: 0.045,           // lower cap to prevent extreme spinning
    GRIP: 0.025,
    REALIGN_RATE: 0,              // 0 = Data Wing-style (no auto-realign)
    DRIFT_DRAG_EXP: 2.0,
    DRIFT_DRAG_SCALE: 0.008,
    ARROW_LENGTH: 22,
    ARROW_WIDTH: 10,
    TRACK_WIDTH: 140,
    MIN_TRACK_WIDTH: 38,
    BRAKE_DECEL: 0.02,
    BRAKE_MIN_SPEED: 0.05,
    SEGMENT_LENGTH: 12,
    LOOK_AHEAD: 120,
    LOOK_BEHIND: 100,
    SPEED_RECOVERY: 0.012,
    SPEED_RECOVERY_RELEASE: 0.06,
    DIFFICULTY_RAMP: 0.00012,
    METERS_PER_SEGMENT: 0.03,   // 1/100 scale — arrow ≈10cm, km takes very long
    OVERLAP_MARGIN: 15,
    // Agent steering
    WANDER_WEIGHT: 1.0,
    WANDER_FREQUENCY: 0.08,
    WANDER_AMPLITUDE: 0.06,
    AVOIDANCE_WEIGHT: 3.0,
    AVOIDANCE_RADIUS: 500,
    RHYTHM_WEIGHT: 0.7,
    RHYTHM_FREQUENCY: 0.12,
    RHYTHM_AMPLITUDE: 0.04,
    EVENT_WEIGHT: 1.5,
    EVENT_INTENSITY: 0.10,
    EVENT_DECAY: 0.92,
    EVENT_INTERVAL_MIN: 15,
    EVENT_INTERVAL_MAX: 60,
    CENTERING_WEIGHT: 0.15,
    WIDTH_CURVATURE_COUPLING: 0.7,
    WIDTH_TRANSITION_RATE: 0.12,
    // Agent physics (mirrors Arrow physics, slightly conservative)
    AGENT_STEER_RATE: 0.011,
    AGENT_STEER_MAX: 0.038,
    AGENT_GRIP: 0.030,
    // Track center offset from agent path
    OFFSET_FREQUENCY: 0.02,
    OFFSET_AMPLITUDE: 0.8,
    AGENT_MARGIN: 18,
    // Timer
    START_TIME: 30,
    TIME_TOKEN_VALUE: 3.5,
    TOKEN_RADIUS: 10,
};

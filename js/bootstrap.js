'use strict';

// ============================================================
// BOOTSTRAP
// ============================================================
// Expose for dev.html
window.__DRIFT_CFG_LIVE = CFG;

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.start();

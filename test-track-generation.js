#!/usr/bin/env node
'use strict';

/**
 * Track generation overlap test.
 *
 * Generates very long tracks with multiple random seeds and verifies
 * that no two non-adjacent track segments overlap (accounting for wall width).
 *
 * Run: node test-track-generation.js
 *
 * This test should pass any time the procedural generation changes.
 */

// Extract the script from index.html and evaluate it in a sandboxed way
const fs = require('fs');
const path = require('path');

// ---- Inline the necessary code from index.html ----
// We replicate the exact same config, utils, and Track class so the test
// stays in sync with the game. If the game code changes, update here too
// OR use the extraction approach below.

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
    console.error('FAIL: Could not extract <script> from index.html');
    process.exit(1);
}

// We need to eval the game code but prevent it from running (it auto-starts).
// Replace the bootstrap section that creates canvas/game and starts the loop.
let gameCode = scriptMatch[1];

// Remove the bootstrap code that accesses DOM
gameCode = gameCode.replace(
    /\/\/ =+\s*\n\s*\/\/ BOOTSTRAP[\s\S]*$/,
    ''
);

// Remove DOM-dependent classes (InputManager, GameRenderer, Game, GameAudio)
// by only extracting what we need. Instead, let's eval and catch errors.
// Actually, let's just make canvas/document/window stubs.

const stubCode = `
    const window = { innerWidth: 400, innerHeight: 800, addEventListener: () => {} };
    const document = { addEventListener: () => {}, getElementById: () => ({
        getContext: () => ({}), addEventListener: () => {}, width: 400, height: 800
    }) };
    const localStorage = { getItem: () => '0', setItem: () => {} };
    const requestAnimationFrame = () => {};
    const Date = { now: () => 0 };
`;

// Eval everything in a function scope
let CFG, Track, PATTERN, normalizeAngle, lerp, clamp, dist;
try {
    const fn = new Function(stubCode + gameCode + `
        return { CFG, Track, PATTERN, normalizeAngle, lerp, clamp, dist };
    `);
    const result = fn();
    CFG = result.CFG;
    Track = result.Track;
    PATTERN = result.PATTERN;
    normalizeAngle = result.normalizeAngle;
    lerp = result.lerp;
    clamp = result.clamp;
    dist = result.dist;
} catch (e) {
    console.error('FAIL: Could not eval game code:', e.message);
    process.exit(1);
}

// ---- Test configuration ----
const NUM_RUNS = 20;           // number of random track generations to test
const SEGMENTS_PER_RUN = 5000; // total segments to generate per run
const OVERLAP_MARGIN = 5;      // px margin — walls closer than this = overlap
const ADJACENT_SKIP = 40;      // skip this many neighbors (they're adjacent by design)

// Simulate the actual game's visible window:
// The game only keeps LOOK_AHEAD + LOOK_BEHIND segments alive at once.
// Older segments are trimmed (shifted out of spine array).
// We replicate this trimming so we only test overlaps between segments
// that actually coexist in-game.
const MAX_LIVE_SEGMENTS = CFG.LOOK_AHEAD + CFG.LOOK_BEHIND + 20; // ~240

// ---- Overlap detection ----
// Two segments overlap if the distance between their center lines,
// minus their combined half-widths, is less than OVERLAP_MARGIN.
// Checks all pairs in the live window (skipping adjacent neighbors).
function checkTrackOverlaps(spine) {
    const overlaps = [];
    for (let i = 0; i < spine.length; i++) {
        const a = spine[i];
        for (let j = i + ADJACENT_SKIP; j < spine.length; j++) {
            const b = spine[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const centerDist = Math.sqrt(dx * dx + dy * dy);
            const combinedHalfWidths = (a.width + b.width) / 2;

            if (centerDist < combinedHalfWidths + OVERLAP_MARGIN) {
                overlaps.push({
                    segA: a.index,
                    segB: b.index,
                    centerDist: centerDist.toFixed(1),
                    combinedHW: combinedHalfWidths.toFixed(1),
                    gap: (centerDist - combinedHalfWidths).toFixed(1)
                });
                if (overlaps.length > 50) return overlaps;
            }
        }
    }
    return overlaps;
}

// ---- Run tests ----
console.log(`Running ${NUM_RUNS} track generation tests with ${SEGMENTS_PER_RUN} segments each...`);
console.log(`Simulating game trimming: max ${MAX_LIVE_SEGMENTS} live segments at a time\n`);

let totalOverlaps = 0;
let failedRuns = 0;

for (let run = 0; run < NUM_RUNS; run++) {
    const track = new Track();
    track.init(200, 400);

    let runOverlaps = [];

    // Generate segments one at a time, simulating player advancing
    for (let i = 0; i < SEGMENTS_PER_RUN; i++) {
        track.generateNext();

        // Simulate game trimming: remove old segments that the game would discard
        // The game trims when spine[0].index < arrowSegIdx - LOOK_BEHIND
        // The "arrow" is roughly at spine.length - LOOK_AHEAD from the end
        while (track.spine.length > MAX_LIVE_SEGMENTS) {
            track.spine.shift();
        }

        // Check for overlaps periodically (every 50 segments to keep test fast)
        if (i % 50 === 0 && i > 0) {
            const overlaps = checkTrackOverlaps(track.spine);
            if (overlaps.length > 0) {
                for (const o of overlaps) {
                    // Deduplicate by segment pair
                    const key = `${o.segA}-${o.segB}`;
                    if (!runOverlaps.find(r => `${r.segA}-${r.segB}` === key)) {
                        runOverlaps.push(o);
                    }
                }
                if (runOverlaps.length > 50) break;
            }
        }
    }

    // Final check on remaining segments
    const finalOverlaps = checkTrackOverlaps(track.spine);
    for (const o of finalOverlaps) {
        const key = `${o.segA}-${o.segB}`;
        if (!runOverlaps.find(r => `${r.segA}-${r.segB}` === key)) {
            runOverlaps.push(o);
        }
    }

    if (runOverlaps.length > 0) {
        failedRuns++;
        totalOverlaps += runOverlaps.length;
        console.log(`  FAIL run ${run + 1}: ${runOverlaps.length} overlap(s) found`);
        for (let k = 0; k < Math.min(3, runOverlaps.length); k++) {
            const o = runOverlaps[k];
            console.log(`    seg ${o.segA} <-> seg ${o.segB}: center dist=${o.centerDist}, combined half-widths=${o.combinedHW}, gap=${o.gap}px`);
        }
    } else {
        console.log(`  PASS run ${run + 1}: ${SEGMENTS_PER_RUN} segments generated, no overlaps in live window`);
    }
}

console.log(`\n${'='.repeat(50)}`);
if (failedRuns > 0) {
    console.log(`FAILED: ${failedRuns}/${NUM_RUNS} runs had overlaps (${totalOverlaps} total overlapping segment pairs)`);
    process.exit(1);
} else {
    console.log(`PASSED: All ${NUM_RUNS} runs clean, no track overlaps detected`);
    process.exit(0);
}

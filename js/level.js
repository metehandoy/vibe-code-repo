// level.js — Procedural level generation with chunk system

import { randomInt, randomChoice, randomRange } from './utils.js';

const CHUNK_WIDTH = 600;
const PLATFORM_H = 20;
const SPIKE_SIZE = 16;
const STAR_SIZE = 14;

// Segment template types
const TEMPLATES = ['FLAT', 'GAP', 'PLATFORM_HIGH', 'PLATFORM_LOW', 'SPIKE_FLOOR', 'SPIKE_CEILING', 'NARROW'];

function getDifficulty(chunkIndex) {
    return Math.min(chunkIndex / 15, 1); // 0 to 1 over ~15 chunks
}

function selectTemplates(difficulty, count) {
    const available = ['FLAT'];
    if (difficulty > 0.05) available.push('GAP', 'PLATFORM_HIGH');
    if (difficulty > 0.15) available.push('PLATFORM_LOW', 'SPIKE_FLOOR');
    if (difficulty > 0.3) available.push('SPIKE_CEILING');
    if (difficulty > 0.5) available.push('NARROW');

    const templates = [];
    for (let i = 0; i < count; i++) {
        templates.push(randomChoice(available));
    }
    return templates;
}

export class Chunk {
    constructor(index, canvasHeight) {
        this.index = index;
        this.x = index * CHUNK_WIDTH;
        this.w = CHUNK_WIDTH;
        this.platforms = [];
        this.spikes = [];
        this.stars = [];
        this.generate(canvasHeight);
    }

    generate(canvasH) {
        const diff = getDifficulty(this.index);
        const groundY = canvasH - 60;
        const ceilY = 60;

        // First chunk is always safe
        if (this.index <= 1) {
            this.platforms.push({
                x: this.x, y: groundY,
                w: CHUNK_WIDTH, h: PLATFORM_H
            });
            if (this.index === 1) {
                this.stars.push({
                    x: this.x + CHUNK_WIDTH / 2 - STAR_SIZE / 2,
                    y: groundY - 80,
                    w: STAR_SIZE, h: STAR_SIZE,
                    collected: false
                });
            }
            return;
        }

        const segCount = 2 + Math.floor(diff * 2);
        const segWidth = CHUNK_WIDTH / segCount;
        const templates = selectTemplates(diff, segCount);

        for (let i = 0; i < segCount; i++) {
            const sx = this.x + i * segWidth;
            const tmpl = templates[i];

            switch (tmpl) {
                case 'FLAT':
                    this.platforms.push({
                        x: sx, y: groundY,
                        w: segWidth, h: PLATFORM_H
                    });
                    break;

                case 'GAP': {
                    const gapW = Math.min(segWidth * 0.5, 100 + diff * 60);
                    const gapX = sx + (segWidth - gapW) / 2;
                    // Platform before gap
                    this.platforms.push({
                        x: sx, y: groundY,
                        w: gapX - sx, h: PLATFORM_H
                    });
                    // Platform after gap
                    this.platforms.push({
                        x: gapX + gapW, y: groundY,
                        w: sx + segWidth - (gapX + gapW), h: PLATFORM_H
                    });
                    break;
                }

                case 'PLATFORM_HIGH': {
                    this.platforms.push({
                        x: sx, y: groundY,
                        w: segWidth, h: PLATFORM_H
                    });
                    const pw = segWidth * 0.6;
                    this.platforms.push({
                        x: sx + (segWidth - pw) / 2,
                        y: groundY - 100 - randomRange(0, 50),
                        w: pw, h: PLATFORM_H
                    });
                    break;
                }

                case 'PLATFORM_LOW': {
                    // No ground — floating platform in lower area
                    const pw = segWidth * 0.7;
                    this.platforms.push({
                        x: sx + (segWidth - pw) / 2,
                        y: groundY - 40,
                        w: pw, h: PLATFORM_H
                    });
                    // Ceiling platform (reachable with gravity flip)
                    const cw = segWidth * 0.5;
                    this.platforms.push({
                        x: sx + (segWidth - cw) / 2,
                        y: ceilY + 20,
                        w: cw, h: PLATFORM_H
                    });
                    break;
                }

                case 'SPIKE_FLOOR':
                    this.platforms.push({
                        x: sx, y: groundY,
                        w: segWidth, h: PLATFORM_H
                    });
                    // Add spikes on the ground
                    for (let s = 0; s < Math.floor(segWidth / (SPIKE_SIZE * 2)); s++) {
                        this.spikes.push({
                            x: sx + SPIKE_SIZE + s * SPIKE_SIZE * 2,
                            y: groundY - SPIKE_SIZE,
                            w: SPIKE_SIZE, h: SPIKE_SIZE,
                            dir: 'up'
                        });
                    }
                    break;

                case 'SPIKE_CEILING':
                    this.platforms.push({
                        x: sx, y: groundY,
                        w: segWidth, h: PLATFORM_H
                    });
                    // Ceiling
                    this.platforms.push({
                        x: sx, y: ceilY,
                        w: segWidth, h: PLATFORM_H
                    });
                    // Spikes hanging from ceiling
                    for (let s = 0; s < Math.floor(segWidth / (SPIKE_SIZE * 2)); s++) {
                        this.spikes.push({
                            x: sx + SPIKE_SIZE + s * SPIKE_SIZE * 2,
                            y: ceilY + PLATFORM_H,
                            w: SPIKE_SIZE, h: SPIKE_SIZE,
                            dir: 'down'
                        });
                    }
                    break;

                case 'NARROW':
                    // Narrow passage with spikes on both sides
                    this.platforms.push({
                        x: sx, y: groundY,
                        w: segWidth, h: PLATFORM_H
                    });
                    this.platforms.push({
                        x: sx, y: ceilY + 80,
                        w: segWidth, h: PLATFORM_H
                    });
                    // Spikes on ceiling platform
                    for (let s = 0; s < Math.floor(segWidth / (SPIKE_SIZE * 3)); s++) {
                        this.spikes.push({
                            x: sx + SPIKE_SIZE * 1.5 + s * SPIKE_SIZE * 3,
                            y: ceilY + 80 + PLATFORM_H,
                            w: SPIKE_SIZE, h: SPIKE_SIZE,
                            dir: 'down'
                        });
                    }
                    break;
            }
        }

        // Add stars
        const starCount = 1 + randomInt(0, Math.floor(1 + diff));
        for (let i = 0; i < starCount; i++) {
            const sx = this.x + randomRange(30, CHUNK_WIDTH - 30);
            const sy = randomRange(ceilY + 50, groundY - 50);
            this.stars.push({
                x: sx, y: sy,
                w: STAR_SIZE, h: STAR_SIZE,
                collected: false
            });
        }
    }
}

export class Level {
    constructor(canvasHeight) {
        this.canvasHeight = canvasHeight;
        this.chunks = [];
        this.nextChunkIndex = 0;
        // Generate initial chunks
        for (let i = 0; i < 5; i++) {
            this.addChunk();
        }
    }

    addChunk() {
        this.chunks.push(new Chunk(this.nextChunkIndex, this.canvasHeight));
        this.nextChunkIndex++;
    }

    update(cameraX) {
        // Generate chunks ahead
        const aheadX = cameraX + CHUNK_WIDTH * 3;
        while (this.nextChunkIndex * CHUNK_WIDTH < aheadX) {
            this.addChunk();
        }

        // Remove chunks far behind
        this.chunks = this.chunks.filter(c => c.x + c.w > cameraX - CHUNK_WIDTH);
    }

    getAllPlatforms() {
        const platforms = [];
        for (const chunk of this.chunks) {
            platforms.push(...chunk.platforms);
        }
        return platforms;
    }

    getAllSpikes() {
        const spikes = [];
        for (const chunk of this.chunks) {
            spikes.push(...chunk.spikes);
        }
        return spikes;
    }

    getAllStars() {
        const stars = [];
        for (const chunk of this.chunks) {
            for (const star of chunk.stars) {
                if (!star.collected) stars.push(star);
            }
        }
        return stars;
    }
}

export { CHUNK_WIDTH };

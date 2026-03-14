# Gravity Shift

A mobile-friendly HTML5 side-scrolling platformer where you tap to flip gravity and the world rotates every 10 seconds.

## How to Play

1. Open `index.html` in a browser (or serve with any static file server)
2. **Tap** (or click / press Space) to flip gravity
3. Collect stars for bonus points
4. Avoid spikes and don't fall off-screen
5. The world rotates 90° every few seconds — adapt or die!

## Controls

- **Mobile**: Tap anywhere to flip gravity
- **Desktop**: Click, Space, or Arrow keys

## Running Locally

No build tools needed. Just open the file or use a local server:

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .
```

Then open `http://localhost:8000` in your browser.

## Tech Stack

- Pure HTML5 Canvas + vanilla JavaScript (ES modules)
- Web Audio API for synthesized sound effects
- No dependencies, no build step

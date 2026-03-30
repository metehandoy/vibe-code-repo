#!/usr/bin/env python3
"""
sync-dev.py  —  copies the game code from separate JS files into dev.html.

Run manually:
    python3 scripts/sync-dev.py

Or automatically via the pre-commit hook whenever JS files are staged.

How it works:
  1. Reads each JS file from the js/ directory in load order.
  2. Concatenates them into a single script block.
  3. Applies four small patches so the code works embedded in dev.html
     (no URL-hash CFG, restartable game loop).
  4. Replaces the content between the two marker comments in dev.html.
"""

import re, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DEV   = ROOT / 'dev.html'

# Ordered list of JS files — must match the <script> tag order in index.html
JS_FILES = [
    'js/config.js',
    'js/utils.js',
    'js/track.js',
    'js/arrow.js',
    'js/particles.js',
    'js/tokens.js',
    'js/hazards.js',
    'js/input.js',
    'js/audio.js',
    'js/renderer.js',
    'js/game.js',
    'js/bootstrap.js',
]

MARKER_BEGIN = '// === GAME CODE BEGIN (auto-synced from index.html) ==='
MARKER_END   = '// === GAME CODE END ==='


def read_js_files() -> str:
    """Read and concatenate all JS files, stripping per-file 'use strict' directives."""
    parts = []
    for js_file in JS_FILES:
        path = ROOT / js_file
        if not path.exists():
            sys.exit(f'sync-dev: ERROR – JS file not found: {js_file}')
        content = path.read_text(encoding='utf-8')
        # Strip standalone 'use strict'; lines — we add one at the top
        content = re.sub(r"^\s*'use strict';\s*\n", '', content)
        parts.append(content)
    return '\n'.join(parts)


def transform(script: str) -> str:
    """Apply dev.html-specific patches to the concatenated game script."""

    # Add 'use strict' at the top
    script = "    'use strict';\n\n" + script

    # ------------------------------------------------------------------ #
    # 1. Replace URL-hash CFG init with a plain mutable object.
    #    The CFG properties themselves are kept verbatim.
    # ------------------------------------------------------------------ #
    script = re.sub(
        r'// Read config overrides from URL hash \(used by dev\.html\)\n'
        r'let __hashCfg = null;\n'
        r'try \{\n'
        r'    if \(window\.location\.hash\.length > 1\) \{\n'
        r'        __hashCfg = JSON\.parse\(decodeURIComponent\(window\.location\.hash\.slice\(1\)\)\);\n'
        r'    \}\n'
        r'\} catch\(e\) \{\}\n'
        r'\n'
        r'const CFG = __hashCfg \|\| window\.__DRIFT_CFG \|\| \{',
        'const CFG = {',
        script
    )

    # After the CFG closing }; inject a localStorage overlay so the dev
    # panel's saved settings are applied before the game starts.
    script = script.replace(
        '    DEATH_HAZARD_RADIUS: 5,\n};',
        '    DEATH_HAZARD_RADIUS: 5,\n};\n'
        '// Overlay saved dev config from localStorage\n'
        'try {\n'
        "    const _devSaved = localStorage.getItem('driftArrowDevConfig');\n"
        '    if (_devSaved) Object.assign(CFG, JSON.parse(_devSaved));\n'
        '} catch(e) {}',
        1
    )

    # ------------------------------------------------------------------ #
    # 2. Add this.stopped flag to the Game constructor so the loop can
    #    be halted when the game is restarted by the dev panel.
    # ------------------------------------------------------------------ #
    script = script.replace(
        '        this.isNewHigh = false;',
        '        this.isNewHigh = false;\n'
        '            this.stopped = false;'
    )

    # ------------------------------------------------------------------ #
    # 3. Guard the game loop with this.stopped and expose a stop() method.
    # ------------------------------------------------------------------ #
    script = script.replace(
        '    loop(timestamp) {\n'
        '        this.update(timestamp);\n'
        '        this.render();\n'
        '        requestAnimationFrame((t) => this.loop(t));\n'
        '    }',
        '    loop(timestamp) {\n'
        '        if (this.stopped) return;\n'
        '        this.update(timestamp);\n'
        '        this.render();\n'
        '        requestAnimationFrame((t) => this.loop(t));\n'
        '    }\n'
        '    stop() { this.stopped = true; }'
    )

    # ------------------------------------------------------------------ #
    # 4. Replace the single-instance bootstrap with a restartable helper
    #    that the dev panel's Apply button can call.
    # ------------------------------------------------------------------ #
    script = script.replace(
        '// Expose for dev.html\n'
        'window.__DRIFT_CFG_LIVE = CFG;\n'
        '\n'
        "const canvas = document.getElementById('game');\n"
        'const game = new Game(canvas);\n'
        'game.start();',
        'window.__DRIFT_CFG_LIVE = CFG;\n'
        '\n'
        "const canvas = document.getElementById('game');\n"
        'let _currentGame = null;\n'
        'function _startGame() {\n'
        '    if (_currentGame) _currentGame.stop();\n'
        '    _currentGame = new Game(canvas);\n'
        '    _currentGame.start();\n'
        '}\n'
        '_startGame();'
    )

    return script


def verify(patched: str):
    """Fail fast if any transform didn't apply."""
    checks = [
        ('__hashCfg' not in patched,   'CFG URL-hash init transform failed'),
        ('_devSaved' in patched,         'CFG localStorage overlay transform failed'),
        ('this.stopped = false' in patched, 'Game constructor stopped flag missing'),
        ('if (this.stopped) return;' in patched, 'loop stop-guard transform failed'),
        ('stop() { this.stopped = true; }' in patched, 'stop() method transform failed'),
        ('_startGame' in patched,       'bootstrap transform failed'),
    ]
    for ok, msg in checks:
        if not ok:
            sys.exit(f'sync-dev: ERROR – {msg}')


def sync():
    dev_html   = DEV.read_text(encoding='utf-8')

    if MARKER_BEGIN not in dev_html:
        sys.exit(f'sync-dev: ERROR – begin marker not found in dev.html:\n  {MARKER_BEGIN}')
    if MARKER_END not in dev_html:
        sys.exit(f'sync-dev: ERROR – end marker not found in dev.html:\n  {MARKER_END}')

    raw     = read_js_files()
    patched = transform(raw)
    verify(patched)

    before = dev_html[:dev_html.index(MARKER_BEGIN)]
    after  = dev_html[dev_html.index(MARKER_END) + len(MARKER_END):]

    new_dev = before + MARKER_BEGIN + '\n' + patched + '\n    ' + MARKER_END + after
    DEV.write_text(new_dev, encoding='utf-8')
    print('sync-dev: dev.html updated from js/*.js')


if __name__ == '__main__':
    sync()

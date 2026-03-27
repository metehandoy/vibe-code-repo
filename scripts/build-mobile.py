#!/usr/bin/env python3
"""
build-mobile.py  —  merges all separate JS files back into a single mobile.html.

Run manually:
    python3 scripts/build-mobile.py

Or automatically via the post-commit hook after every commit.

How it works:
  1. Reads index.html to extract the HTML shell (everything except <script src="js/..."> tags).
  2. Reads each JS file referenced by <script src="js/..."> in order.
  3. Concatenates all JS into a single inline <script> block.
  4. Writes the result to mobile.html — a zero-dependency single file for mobile.
"""

import json, re, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
INDEX = ROOT / 'index.html'
MOBILE = ROOT / 'dist' / 'mobile.html'
CONFIG_JS = ROOT / 'js' / 'config.js'
DEV_CONFIG = ROOT / 'drift-config.json'

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


def read_js_files():
    """Read and concatenate all JS files, stripping per-file 'use strict' directives."""
    parts = []
    for js_file in JS_FILES:
        path = ROOT / js_file
        if not path.exists():
            sys.exit(f'build-mobile: ERROR – JS file not found: {js_file}')
        content = path.read_text(encoding='utf-8')
        # Strip standalone 'use strict'; lines — we add one at the top
        content = re.sub(r"^\s*'use strict';\s*\n", '', content)
        parts.append(content)
    return '\n'.join(parts)


def extract_html_shell(html):
    """Extract the HTML before and after the <script src="js/..."> block."""
    # Find the first <script src="js/..."> tag
    first_script = re.search(r'\n?\s*<script src="js/[^"]+"></script>', html)
    if not first_script:
        sys.exit('build-mobile: ERROR – no <script src="js/..."> tags found in index.html')

    # Find the last <script src="js/..."> tag
    last_script_end = 0
    for m in re.finditer(r'\s*<script src="js/[^"]+"></script>\n?', html):
        last_script_end = m.end()

    before = html[:first_script.start()]
    after = html[last_script_end:]

    return before, after


def apply_dev_config():
    """If drift-config.json exists, patch matching values into js/config.js."""
    if not DEV_CONFIG.exists():
        return
    try:
        overrides = json.loads(DEV_CONFIG.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError) as e:
        print(f'build-mobile: WARNING – could not read {DEV_CONFIG.name}: {e}')
        return

    config_src = CONFIG_JS.read_text(encoding='utf-8')
    count = 0
    for key, value in overrides.items():
        # Format the number: drop trailing zeros but keep at least one decimal
        # for floats, use plain int repr for whole numbers
        if isinstance(value, float) and value == int(value) and '.' in str(value):
            formatted = f'{value:g}'
            if '.' not in formatted:
                formatted += '.0'
        elif isinstance(value, float):
            formatted = f'{value:g}'
        else:
            formatted = str(value)
        # Match "    KEY: <number>," with optional trailing comment
        pattern = rf'(    {re.escape(key)}:\s*)-?[\d.]+(\s*,)'
        new_src = re.sub(pattern, rf'\g<1>{formatted}\2', config_src, count=1)
        if new_src != config_src:
            config_src = new_src
            count += 1
    if count > 0:
        CONFIG_JS.write_text(config_src, encoding='utf-8')
        print(f'build-mobile: updated {count} value(s) in config.js from {DEV_CONFIG.name}')


def build():
    if not INDEX.exists():
        sys.exit('build-mobile: ERROR – index.html not found')

    apply_dev_config()

    index_html = INDEX.read_text(encoding='utf-8')
    js_code = read_js_files()
    before, after = extract_html_shell(index_html)

    # Build the merged HTML with a single inline script
    mobile_html = before + '\n    <script>\n    \'use strict\';\n\n' + js_code + '\n    </script>\n' + after

    MOBILE.write_text(mobile_html, encoding='utf-8')
    print('build-mobile: mobile.html generated from index.html + js/*.js')


if __name__ == '__main__':
    build()

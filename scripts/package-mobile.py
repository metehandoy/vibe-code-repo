#!/usr/bin/env python3
"""
package-mobile.py — Package Drift Arrow into .apk (Android) and .ipa (iOS)

Wraps dist/mobile.html in a native WebView shell using Capacitor.
Output: dist/drift-arrow-debug.apk  (Android)
        dist/drift-arrow.xcarchive  (iOS — macOS + Xcode only)

Android prerequisites
---------------------
  1. Node.js >= 16
  2. Java JDK >= 11   (already required for Gradle)
  3. Android SDK with these components:
       sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
     Quick install (Linux/macOS):
       wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
       unzip commandlinetools-linux-*.zip -d ~/android-sdk/cmdline-tools/latest
       ~/android-sdk/cmdline-tools/latest/bin/sdkmanager \
           "platform-tools" "platforms;android-34" "build-tools;34.0.0"
       export ANDROID_HOME=~/android-sdk
  4. ANDROID_HOME (or ANDROID_SDK_ROOT) environment variable set

iOS prerequisites (macOS only)
-------------------------------
  1. Xcode >= 15   (App Store)
  2. Xcode command-line tools:  xcode-select --install
  3. CocoaPods:  sudo gem install cocoapods
  4. Apple Developer account (for device/distribution builds)

Usage
-----
  python3 scripts/package-mobile.py               # build Android APK (default)
  python3 scripts/package-mobile.py --ios         # print iOS build instructions
  python3 scripts/package-mobile.py --all         # Android + iOS steps
  python3 scripts/package-mobile.py --release     # release build (needs keystore)
  python3 scripts/package-mobile.py --clean       # wipe build/ and start fresh
"""

import argparse
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
REPO_ROOT   = Path(__file__).resolve().parent.parent
DIST_DIR    = REPO_ROOT / "dist"
BUILD_DIR   = REPO_ROOT / "build" / "capacitor"
WWW_DIR     = BUILD_DIR / "www"
ANDROID_DIR = BUILD_DIR / "android"
IOS_DIR     = BUILD_DIR / "ios"

APP_ID      = "com.driftarrow.game"
APP_NAME    = "Drift Arrow"
ANDROID_SDK = 34


# ── Helpers ──────────────────────────────────────────────────────────────────
def banner(msg: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {msg}")
    print('─' * 60)


def run(cmd: list[str], cwd: Path | None = None, env: dict | None = None,
        check: bool = True) -> subprocess.CompletedProcess:
    merged_env = {**os.environ, **(env or {})}
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    return subprocess.run(cmd, cwd=cwd, env=merged_env, check=check)


def check_tool(name: str) -> Path | None:
    return shutil.which(name)


def require_tool(name: str, install_hint: str) -> Path:
    path = check_tool(name)
    if not path:
        print(f"\n[ERROR] '{name}' not found in PATH.")
        print(f"        {install_hint}")
        sys.exit(1)
    return Path(path)


# ── Prerequisite checks ──────────────────────────────────────────────────────
def check_node() -> Path:
    return require_tool("node",
        "Install Node.js >= 16: https://nodejs.org  or  nvm install 22")


def check_java() -> Path:
    return require_tool("java",
        "Install JDK >= 11: sudo apt install openjdk-21-jdk  or  brew install openjdk")


def check_android_sdk() -> Path:
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or ""
    if not sdk:
        # Common default locations
        candidates = [
            Path.home() / "Android" / "Sdk",
            Path.home() / "android-sdk",
            Path("/opt/android-sdk"),
        ]
        for c in candidates:
            if (c / "platform-tools").is_dir():
                sdk = str(c)
                break

    if not sdk or not Path(sdk).is_dir():
        print("\n[ERROR] Android SDK not found.")
        print("        Set ANDROID_HOME to your SDK root.  Quick setup:")
        print()
        print("        # Download command-line tools from developer.android.com/studio#command-line-tools-only")
        print("        # Then:")
        print("        mkdir -p ~/android-sdk/cmdline-tools/latest")
        print("        unzip commandlinetools-*.zip -d ~/android-sdk/cmdline-tools/latest --strip 1")
        print("        export ANDROID_HOME=~/android-sdk")
        print("        $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager \\")
        print('            "platform-tools" "platforms;android-34" "build-tools;34.0.0"')
        sys.exit(1)

    sdk_path = Path(sdk)
    build_tools = list((sdk_path / "build-tools").glob("*")) if (sdk_path / "build-tools").is_dir() else []
    platforms  = list((sdk_path / "platforms").glob("android-*")) if (sdk_path / "platforms").is_dir() else []

    if not build_tools or not platforms:
        print("\n[ERROR] Android SDK is incomplete. Missing build-tools or platforms.")
        print(f"        SDK root: {sdk_path}")
        print("        Run:")
        print(f"        $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager \\")
        print('            "platform-tools" "platforms;android-34" "build-tools;34.0.0"')
        sys.exit(1)

    print(f"  ✓  Android SDK: {sdk_path}")
    return sdk_path


# ── Project setup ─────────────────────────────────────────────────────────────
def write_capacitor_config() -> None:
    config = f"""\
{{
  "appId": "{APP_ID}",
  "appName": "{APP_NAME}",
  "webDir": "www",
  "server": {{
    "androidScheme": "https",
    "iosScheme": "https"
  }},
  "android": {{
    "backgroundColor": "#0a0014",
    "allowMixedContent": false,
    "captureInput": true,
    "webContentsDebuggingEnabled": true
  }},
  "ios": {{
    "backgroundColor": "#0a0014",
    "contentInset": "always"
  }}
}}
"""
    (BUILD_DIR / "capacitor.config.json").write_text(config)
    print("  ✓  capacitor.config.json written")


def write_package_json() -> None:
    pkg = f"""\
{{
  "name": "drift-arrow",
  "version": "1.0.0",
  "description": "Drift Arrow mobile app",
  "private": true,
  "scripts": {{
    "build:android": "npx cap sync android && cd android && ./gradlew assembleDebug",
    "build:ios":     "npx cap sync ios"
  }},
  "dependencies": {{
    "@capacitor/android": "^6.0.0",
    "@capacitor/core":    "^6.0.0",
    "@capacitor/ios":     "^6.0.0"
  }},
  "devDependencies": {{
    "@capacitor/cli": "^6.0.0"
  }}
}}
"""
    (BUILD_DIR / "package.json").write_text(pkg)
    print("  ✓  package.json written")


def copy_game_content() -> None:
    WWW_DIR.mkdir(parents=True, exist_ok=True)
    src = DIST_DIR / "mobile.html"
    if not src.exists():
        print("\n[ERROR] dist/mobile.html not found.")
        print("        Run  python3 scripts/build-mobile.py  first.")
        sys.exit(1)
    shutil.copy(src, WWW_DIR / "index.html")
    print(f"  ✓  Copied {src.name} → www/index.html")


def setup_capacitor_project(sdk_path: Path, release: bool) -> None:
    env_extra = {"ANDROID_HOME": str(sdk_path), "ANDROID_SDK_ROOT": str(sdk_path)}

    node_path = Path(check_tool("node")).parent  # type: ignore[arg-type]
    npx = node_path / "npx"

    banner("Installing Capacitor dependencies")
    run(["npm", "install"], cwd=BUILD_DIR)

    banner("Adding Capacitor Android platform")
    if not ANDROID_DIR.is_dir():
        run([str(npx), "cap", "add", "android"], cwd=BUILD_DIR, env=env_extra)
    else:
        print("  (android/ already present, skipping cap add)")

    banner("Syncing web assets")
    run([str(npx), "cap", "sync", "android"], cwd=BUILD_DIR, env=env_extra)

    banner("Building Android APK")
    gradle_cmd = ANDROID_DIR / "gradlew"
    task = "assembleRelease" if release else "assembleDebug"
    run([str(gradle_cmd), task], cwd=ANDROID_DIR, env=env_extra)

    # ── Locate and copy the APK ───────────────────────────────────────────
    build_type = "release" if release else "debug"
    apk_candidates = list(ANDROID_DIR.rglob(f"*-{build_type}.apk"))
    if not apk_candidates:
        apk_candidates = list(ANDROID_DIR.rglob("*.apk"))

    if not apk_candidates:
        print("\n[ERROR] APK not found after build. Check Gradle output above.")
        sys.exit(1)

    apk_src  = apk_candidates[0]
    suffix   = "release" if release else "debug"
    apk_dest = DIST_DIR / f"drift-arrow-{suffix}.apk"
    shutil.copy(apk_src, apk_dest)
    print(f"\n  ✓  APK ready: {apk_dest}")
    print(f"     Size: {apk_dest.stat().st_size // 1024} KB")
    print()
    print("  Install on device via USB:")
    print(f"    adb install -r {apk_dest}")
    print()
    print("  Or transfer the file and open it directly on your Android phone")
    print("  (enable 'Install unknown apps' in Settings > Security).")


# ── iOS instructions ──────────────────────────────────────────────────────────
def print_ios_instructions() -> None:
    banner("iOS build (macOS + Xcode required)")

    xcworkspace = IOS_DIR / "App" / "App.xcworkspace"
    if platform.system() != "Darwin":
        print("  iOS builds require macOS with Xcode installed.")
        print("  Transfer this repo to a Mac and run:")
        print()
        print("    python3 scripts/package-mobile.py --ios")
        print()
    else:
        node_path = Path(check_tool("node")).parent  # type: ignore[arg-type]
        npx = node_path / "npx"

        print("  1.  Install CocoaPods (once):")
        print("        sudo gem install cocoapods")
        print()
        print("  2.  Add iOS platform and sync:")
        print(f"        cd {BUILD_DIR}")
        print("        npm install")
        print(f"        {npx} cap add ios")
        print(f"        {npx} cap sync ios")
        print()
        print("  3a. Open in Xcode (recommended for signing + device selection):")
        print(f"        open {xcworkspace}")
        print()
        print("  3b. Or build directly (needs a development team ID):")
        print("        cd ios/App")
        print("        xcodebuild -scheme App -configuration Debug \\")
        print("            -sdk iphoneos -allowProvisioningUpdates \\")
        print("            DEVELOPMENT_TEAM=<YOUR_TEAM_ID>")
        print()
        print("  4.  The .ipa is in the Xcode 'Products' folder or the")
        print("      DerivedData archive output.")

    print()
    print("  Alternatively, convert the PWA using PWA Builder:")
    print("    https://www.pwabuilder.com")
    print("  (host dist/mobile.html, submit the URL, download the .ipa package)")


# ── Entry point ───────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Package Drift Arrow as .apk / .ipa",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--ios",     action="store_true", help="show iOS build instructions")
    parser.add_argument("--all",     action="store_true", help="build Android + print iOS steps")
    parser.add_argument("--release", action="store_true", help="release build (needs signing config)")
    parser.add_argument("--clean",   action="store_true", help="wipe build/ before starting")
    args = parser.parse_args()

    print(f"\n{'═' * 60}")
    print(f"  Drift Arrow — Mobile Packager")
    print(f"{'═' * 60}")

    if args.clean and BUILD_DIR.exists():
        banner("Cleaning build directory")
        shutil.rmtree(BUILD_DIR)
        print(f"  ✓  Removed {BUILD_DIR}")

    if args.ios and not args.all:
        print_ios_instructions()
        return

    # ── Android build ─────────────────────────────────────────────────────
    banner("Checking prerequisites")
    check_node()
    print(f"  ✓  Node.js  {subprocess.check_output(['node', '--version']).decode().strip()}")
    check_java()
    java_ver = subprocess.check_output(
        ["java", "-version"], stderr=subprocess.STDOUT
    ).decode().split("\n")[0]
    print(f"  ✓  Java     {java_ver}")
    sdk_path = check_android_sdk()

    banner("Setting up Capacitor project")
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    write_package_json()
    write_capacitor_config()
    copy_game_content()

    setup_capacitor_project(sdk_path, release=args.release)

    if args.all:
        print_ios_instructions()


if __name__ == "__main__":
    main()

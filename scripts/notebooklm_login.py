"""NotebookLM authentication via Playwright.
Opens a browser for Google login, saves cookies for notebooklm-py.
Cleans up stale lock files automatically.
"""
import sys
import os
import json
import time
import glob
from pathlib import Path

PROFILE_DIR = Path.home() / ".notebooklm" / "profiles" / "default"
STORAGE_PATH = PROFILE_DIR / "storage_state.json"
BROWSER_PROFILE = PROFILE_DIR / "browser_profile"

GOOGLE_DOMAINS = [
    ".google.com", "google.com",
    ".notebooklm.google.com", "notebooklm.google.com",
    "accounts.google.com", ".accounts.google.com",
    ".google.com.ar", "google.com.ar",
    "drive.google.com", ".drive.google.com",
    ".googleusercontent.com",
]

def cleanup_lock_files():
    """Remove stale Chromium lock files."""
    if not BROWSER_PROFILE.exists():
        return
    for name in ["SingletonLock", "SingletonSocket", "SingletonCookie"]:
        lock = BROWSER_PROFILE / name
        if lock.exists():
            try:
                lock.unlink()
            except Exception:
                pass
    # Also clean up stale lockfiles from crashed sessions
    for f in glob.glob(str(BROWSER_PROFILE / "Singleton*")):
        try:
            os.unlink(f)
        except Exception:
            pass

def validate_auth():
    """Check if existing auth is valid by calling notebooklm CLI."""
    import subprocess
    try:
        result = subprocess.run(
            [sys.executable, '-m', 'notebooklm', 'list', '--json'],
            capture_output=True, text=True, timeout=30,
            env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}
        )
        out = result.stdout.strip()
        if out.startswith('{') or out.startswith('['):
            data = json.loads(out)
            if isinstance(data, dict) and data.get('error'):
                return False
            return True
        return 'expired' not in out.lower()
    except Exception:
        return False

def extract_chrome_cookies():
    """Try notebooklm's built-in Chrome extraction."""
    import subprocess
    try:
        result = subprocess.run(
            [sys.executable, '-m', 'notebooklm', 'login', '--browser-cookies', 'chrome'],
            capture_output=True, text=True, timeout=30,
            env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}
        )
        # Check if it actually worked by validating
        time.sleep(1)
        return validate_auth()
    except Exception:
        return False

def playwright_login():
    """Open Playwright browser for Google login. Returns True on success."""
    from playwright.sync_api import sync_playwright

    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    BROWSER_PROFILE.mkdir(parents=True, exist_ok=True)
    cleanup_lock_files()

    print("Opening browser for Google login...", file=sys.stderr)
    print("Log in to your Google account in the browser window.", file=sys.stderr)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ],
        )
        
        context = browser.new_context(
            viewport={"width": 900, "height": 700},
        )
        
        page = context.new_page()

        # Navigate to Google login for NotebookLM
        try:
            page.goto("https://accounts.google.com/ServiceLogin?service=wise&continue=https://notebooklm.google.com/",
                      wait_until="domcontentloaded", timeout=30000)
        except Exception:
            pass

        print("Waiting for login (max 5 minutes)...", file=sys.stderr)

        # Wait for successful login - detect NotebookLM URL
        start = time.time()
        logged_in = False
        while time.time() - start < 300:
            try:
                url = page.url
                if "notebooklm.google.com" in url and "accounts.google.com" not in url:
                    # Wait a bit for cookies to settle
                    time.sleep(3)
                    logged_in = True
                    break
                if page.is_closed():
                    break
            except Exception:
                break
            time.sleep(2)

        if not logged_in:
            # Try extracting cookies anyway - user might have logged in
            pass

        # Extract cookies from all Google-related pages
        all_cookies = context.cookies([
            "https://notebooklm.google.com",
            "https://accounts.google.com",
            "https://myaccount.google.com",
        ])

        context.close()
        browser.close()

    # Filter and save cookies
    google_cookies = []
    for c in all_cookies:
        domain = c.get("domain", "")
        if any(domain.endswith(d) or domain == d for d in GOOGLE_DOMAINS):
            google_cookies.append({
                "name": c["name"],
                "value": c["value"],
                "domain": c["domain"],
                "path": c.get("path", "/"),
                "expires": c.get("expires", -1),
                "httpOnly": c.get("httpOnly", False),
                "secure": c.get("secure", False),
                "sameSite": c.get("sameSite", "None"),
            })

    if not google_cookies:
        print("ERROR: No cookies extracted. Login may not have completed.", file=sys.stderr)
        return False

    # Check for required cookies
    names = {c["name"] for c in google_cookies}
    if "SID" not in names:
        print(f"ERROR: SID cookie missing. Found: {sorted(names)[:10]}", file=sys.stderr)
        return False

    # Save in notebooklm-py format
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    storage_state = {"cookies": google_cookies, "origins": []}
    with open(STORAGE_PATH, "w", encoding="utf-8") as f:
        json.dump(storage_state, f, indent=2)

    print(f"OK: {len(google_cookies)} cookies saved", file=sys.stderr)
    return True

def run():
    # Step 1: Already valid?
    if validate_auth():
        print("OK: Already authenticated")
        return True

    # Step 2: Try Chrome extraction (fast, no UI)
    if extract_chrome_cookies():
        if validate_auth():
            print("OK: Authenticated via Chrome cookies")
            return True

    # Step 3: Playwright login
    if playwright_login():
        time.sleep(2)
        if validate_auth():
            print("OK: Authenticated via browser login")
            return True
        else:
            print("ERROR: Login completed but cookies invalid. Try again.", file=sys.stderr)
            return False

    print("ERROR: Login did not complete", file=sys.stderr)
    return False

if __name__ == "__main__":
    success = run()
    sys.exit(0 if success else 1)

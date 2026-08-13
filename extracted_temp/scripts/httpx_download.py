"""Download artifact using httpx with stored cookies — bypasses the notebooklm library."""
import json
import sys
import httpx
from pathlib import Path

def main():
    url = sys.argv[1] if len(sys.argv) > 1 else None
    output = sys.argv[2] if len(sys.argv) > 2 else None
    if not url:
        print(json.dumps({"error": "Usage: python httpx_download.py <url> <output_path>"}))
        sys.exit(1)

    storage_path = Path.home().joinpath('.notebooklm/profiles/default/storage_state.json')
    storage = json.loads(storage_path.read_text())

    cookies = {}
    for c in storage.get('cookies', []):
        domain = c.get('domain', '')
        if 'google.com' in domain or 'googleusercontent.com' in domain:
            cookies[c['name']] = c['value']

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://notebooklm.google.com/',
        'Accept': '*/*',
    }

    with httpx.Client(cookies=cookies, follow_redirects=True, timeout=60) as client:
        with client.stream('GET', url, headers=headers) as response:
            if response.status_code >= 400:
                body = response.read(500).decode('utf-8', errors='replace')
                print(json.dumps({"error": f"HTTP {response.status_code}", "body": body[:300]}))
                sys.exit(1)

            ct = response.headers.get('content-type', '')
            if 'text/html' in ct:
                body = response.read(500).decode('utf-8', errors='replace')
                print(json.dumps({"error": "Got HTML instead of file", "body": body[:300]}))
                sys.exit(1)

            if output:
                with open(output, 'wb') as f:
                    for chunk in response.iter_bytes(chunk_size=8192):
                        f.write(chunk)
                import os
                size = os.path.getsize(output)
                print(json.dumps({"ok": True, "path": output, "size": size, "content_type": ct}))
            else:
                print(json.dumps({"ok": True, "content_type": ct, "status": response.status_code}))

if __name__ == '__main__':
    main()

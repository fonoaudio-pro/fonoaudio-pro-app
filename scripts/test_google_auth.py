import json, http.client, ssl, urllib.parse
from pathlib import Path

storage = json.loads(Path.home().joinpath('.notebooklm/profiles/default/storage_state.json').read_text())
cookies = storage.get('cookies', [])
cookie_str = '; '.join(f"{c['name']}={c['value']}" for c in cookies if 'google' in c.get('domain', ''))

ssl_ctx = ssl.create_default_context()

# Test the contribution.usercontent.google.com domain
conn = http.client.HTTPSConnection('contribution.usercontent.google.com', context=ssl_ctx, timeout=15)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Cookie': cookie_str,
    'Referer': 'https://notebooklm.google.com/',
    'Accept': '*/*',
}

# Try a test path (will 404 but shows if auth works)
conn.request('GET', '/download?c=test', headers=headers)
resp = conn.getresponse()
print(f'Status: {resp.status}')
print(f'Headers: {dict(resp.getheaders())}')
body = resp.read(1000).decode('utf-8', errors='replace')
print(f'Body: {body[:500]}')
conn.close()

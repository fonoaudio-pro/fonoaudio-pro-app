import json, http.cookiejar, urllib.request, ssl, sys, time
from pathlib import Path

# Load cookies
storage_path = Path.home().joinpath('.notebooklm/profiles/default/storage_state.json')
storage = json.loads(storage_path.read_text())
cookies = [c for c in storage.get('cookies', []) if 'google' in c.get('domain', '')]
print(f'Loaded {len(cookies)} Google cookies')

# Build cookie header
cookie_str = '; '.join([f"{c['name']}={c['value']}" for c in cookies])

# Test with a direct URL to Google's download endpoint
test_url = 'https://contribution.usercontent.google.com/download'
print(f'Test URL: {test_url}')

# Follow redirects manually
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Cookie': cookie_str,
}

import http.client
import ssl as ssl_module

ssl_ctx = ssl_module.create_default_context()

for attempt in range(3):
    parsed = __import__('urllib.parse', fromlist=['urlparse']).urlparse(test_url)
    conn_cls = http.client.HTTPSConnection if parsed.scheme == 'https' else http.client.HTTPConnection
    conn = conn_cls(parsed.hostname, timeout=15)
    
    path_query = parsed.path
    if parsed.query:
        path_query += '?' + parsed.query
    
    print(f'\nAttempt {attempt}: GET {parsed.hostname}{path_query[:100]}')
    conn.request('GET', path_query, headers=headers)
    resp = conn.getresponse()
    
    print(f'  Status: {resp.status}')
    ct = resp.getheader('Content-Type', 'unknown')
    cl = resp.getheader('Content-Length', 'unknown')
    location = resp.getheader('Location', '')
    print(f'  Content-Type: {ct}')
    print(f'  Content-Length: {cl}')
    
    if resp.status in (301, 302, 303, 307, 308):
        print(f'  Redirect to: {location[:150]}')
        test_url = location
        resp.read()
        conn.close()
        continue
    
    body_preview = resp.read(500).decode('utf-8', errors='replace')
    print(f'  Body preview: {body_preview[:300]}')
    resp.read()
    conn.close()
    break

print('\nDone')

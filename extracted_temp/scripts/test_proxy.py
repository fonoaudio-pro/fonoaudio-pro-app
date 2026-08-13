import json, http.cookiejar, urllib.request, ssl, sys
from pathlib import Path

# Load cookies
storage_path = Path.home().joinpath('.notebooklm/profiles/default/storage_state.json')
storage = json.loads(storage_path.read_text())
cookies = [c for c in storage.get('cookies', []) if 'google' in c.get('domain', '')]
print(f'Loaded {len(cookies)} Google cookies')

# Get artifact URLs via notebooklm library
try:
    from notebooklm import NotebookLM
    client = NotebookLM()
    notebooks = client.notebooks.list()
    if not notebooks:
        print('No notebooks found')
        sys.exit(1)
    
    nb = notebooks[0]
    print(f'Notebook: {nb.title} ({nb.id})')
    
    artifacts = nb.artifacts
    if not artifacts:
        print('No artifacts')
        sys.exit(1)
    
    for art in artifacts[:3]:
        url = getattr(art, 'url', None)
        print(f'  Artifact: {art.title} [{art.type_id}] url={url[:80] if url else "None"}')
        
        if url:
            # Test fetching with urllib + cookies
            cookie_jar = http.cookiejar.CookieJar()
            for c in cookies:
                cookie = http.cookiejar.Cookie(
                    version=0, name=c['name'], value=c['value'],
                    port=None, port_specified=False,
                    domain=c['domain'], domain_specified=True, domain_initial_dot=c['domain'].startswith('.'),
                    path=c.get('path', '/'), path_specified=True,
                    secure=c.get('secure', False),
                    expires=int(c.get('expires', -1)),
                    discard=False, comment=None, comment_url=None,
                    rest={}, rfc2109=False
                )
                cookie_jar.set_cookie(cookie)
            
            opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
            opener.addheaders = [
                ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
                ('Referer', 'https://notebooklm.google.com/'),
            ]
            try:
                resp = opener.open(url, timeout=30)
                ct = resp.headers.get('Content-Type', 'unknown')
                cl = resp.headers.get('Content-Length', 'unknown')
                print(f'    -> Status: {resp.status} Content-Type: {ct} Length: {cl}')
            except Exception as e:
                print(f'    -> Error: {e}')
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()

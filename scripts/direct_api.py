"""Direct artifact URL extraction using httpx with stored cookies."""
import json
import sys
import httpx
from pathlib import Path

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python download_artifact.py <notebook_id> [artifact_id]"}))
        sys.exit(1)

    notebook_id = sys.argv[1]
    artifact_id = sys.argv[2] if len(sys.argv) > 2 else None

    storage_path = Path.home().joinpath('.notebooklm/profiles/default/storage_state.json')
    if not storage_path.exists():
        print(json.dumps({"error": "No storage state found. Run: python -m notebooklm login"}))
        sys.exit(1)

    storage = json.loads(storage_path.read_text())
    cookies = {}
    for c in storage.get('cookies', []):
        domain = c.get('domain', '')
        if 'google.com' in domain:
            cookies[c['name']] = c['value']

    print(f"Loaded {len(cookies)} cookies", file=sys.stderr)

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://notebooklm.google.com/',
        'Origin': 'https://notebooklm.google.com',
    }

    # Get notebook info
    rpc_url = 'https://notebooklm.google.com/rpc/NotebookLMRpc'
    
    with httpx.Client(cookies=cookies, headers=headers, timeout=30, follow_redirects=True) as client:
        # List notebooks to get the right one
        print("Listing notebooks...", file=sys.stderr)
        resp = client.post(rpc_url, json=[
            {"method": "GetNotebooks", "params": {}}
        ])
        print(f"Notebooks response: {resp.status_code}", file=sys.stderr)
        
        if resp.status_code != 200:
            print(json.dumps({"error": f"Notebooks API returned {resp.status_code}", "body": resp.text[:500]}))
            sys.exit(1)
        
        data = resp.json()
        notebooks = []
        if isinstance(data, list) and len(data) > 0:
            result = data[0].get('result', {})
            notebooks = result.get('notebooks', [])
        
        print(f"Found {len(notebooks)} notebooks", file=sys.stderr)
        
        # Find target notebook
        target_nb = None
        for nb in notebooks:
            nb_id = nb.get('id', '')
            if nb_id == notebook_id or nb_id.startswith(notebook_id):
                target_nb = nb
                break
        
        if not target_nb and notebook_id == 'default' and notebooks:
            target_nb = notebooks[0]
        
        if not target_nb:
            print(json.dumps({"error": f"Notebook {notebook_id} not found", "available": [n.get('id','') for n in notebooks[:5]]}))
            sys.exit(1)
        
        real_nb_id = target_nb.get('id', notebook_id)
        print(f"Using notebook: {target_nb.get('title', real_nb_id)} ({real_nb_id})", file=sys.stderr)

        # List artifacts
        print("Listing artifacts...", file=sys.stderr)
        resp = client.post(rpc_url, json=[
            {"method": "ListArtifacts", "params": {"notebook_id": real_nb_id}}
        ])
        print(f"Artifacts response: {resp.status_code}", file=sys.stderr)
        
        if resp.status_code != 200:
            print(json.dumps({"error": f"Artifacts API returned {resp.status_code}", "body": resp.text[:500]}))
            sys.exit(1)
        
        data = resp.json()
        artifacts = []
        if isinstance(data, list) and len(data) > 0:
            result = data[0].get('result', {})
            artifacts = result.get('artifacts', [])
        
        print(f"Found {len(artifacts)} artifacts", file=sys.stderr)
        
        # Find target artifact or list all
        if artifact_id:
            target = None
            for art in artifacts:
                art_id = art.get('id', '')
                if art_id == artifact_id or art_id.startswith(artifact_id):
                    target = art
                    break
            if target:
                print(json.dumps(target, indent=2, default=str))
            else:
                print(json.dumps({"error": f"Artifact {artifact_id} not found", "available": [a.get('id','') for a in artifacts[:10]]}))
        else:
            results = []
            for art in artifacts:
                results.append({
                    "id": art.get('id'),
                    "title": art.get('title'),
                    "type": art.get('type'),
                    "status": art.get('status'),
                    "url": art.get('url'),
                    "download_url": art.get('download_url'),
                })
            print(json.dumps(results, indent=2, default=str))

if __name__ == '__main__':
    main()

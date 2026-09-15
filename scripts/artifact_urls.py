"""Get artifact download URLs from NotebookLM API."""
import asyncio
import json
import sys
from notebooklm.client import NotebookLMClient
from notebooklm.auth import load_client_auth

async def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python artifact_urls.py <notebook_id> <artifact_id>"}))
        sys.exit(1)

    notebook_id = sys.argv[1]
    artifact_id = sys.argv[2]

    try:
        auth = load_client_auth()
        async with NotebookLMClient(auth) as client:
            # List all artifacts (this is where URLs are populated)
            artifacts = await client.artifacts.list(notebook_id)
            for art in artifacts:
                if art.id == artifact_id or art.id.startswith(artifact_id):
                    result = {
                        "id": art.id,
                        "title": art.title,
                        "type_id": art.kind.value,
                        "status": art.status_str,
                        "url": art.url,
                        "created_at": art.created_at.isoformat() if art.created_at else None,
                    }
                    print(json.dumps(result))
                    return

            # Not found in list — try get
            art = await client.artifacts.get_or_none(notebook_id, artifact_id)
            if art:
                result = {
                    "id": art.id,
                    "title": art.title,
                    "type_id": art.kind.value,
                    "status": art.status_str,
                    "url": art.url,
                    "created_at": art.created_at.isoformat() if art.created_at else None,
                }
                print(json.dumps(result))
            else:
                print(json.dumps({"error": "Artifact not found", "id": artifact_id}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

asyncio.run(main())

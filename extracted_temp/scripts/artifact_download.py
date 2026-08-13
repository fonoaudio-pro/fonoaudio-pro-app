"""Download artifact to local file using notebooklm Python library."""
import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path

async def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python artifact_download.py <notebook_id> <artifact_id>"}))
        sys.exit(1)

    notebook_id = sys.argv[1]
    artifact_id = sys.argv[2]
    output_dir = os.path.join(tempfile.gettempdir(), 'notebooklm_artifacts')
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    try:
        from notebooklm.client import NotebookLMClient
        from notebooklm.auth import load_client_auth

        auth = load_client_auth()
        async with NotebookLMClient(auth) as client:
            artifacts = await client.artifacts.list(notebook_id)
            target = None
            for art in artifacts:
                if art.id == artifact_id or art.id.startswith(artifact_id):
                    target = art
                    break

            if not target:
                print(json.dumps({"error": "Artifact not found", "id": artifact_id}))
                sys.exit(1)

            kind = target.kind.value
            ext_map = {
                'slide_deck': 'pdf', 'audio': 'mp3', 'video': 'mp4',
                'infographic': 'png', 'report': 'md',
            }
            ext = ext_map.get(kind, 'bin')
            safe_title = "".join(c if c.isalnum() or c in ' _-' else '_' for c in target.title)[:60]
            filename = f"{safe_title}.{ext}"
            output_path = os.path.join(output_dir, filename)

            if kind == 'slide_deck':
                await client.artifacts.download_slide_deck(notebook_id, output_path, target.id, output_format='pdf')
            elif kind == 'audio':
                await client.artifacts.download_audio(notebook_id, output_path, target.id)
            elif kind == 'video':
                await client.artifacts.download_video(notebook_id, output_path, target.id)
            elif kind == 'infographic':
                await client.artifacts.download_infographic(notebook_id, output_path, target.id)
            elif kind == 'report':
                await client.artifacts.download_report(notebook_id, output_path, target.id)
            else:
                print(json.dumps({"error": f"Unsupported type: {kind}", "type": kind}))
                sys.exit(1)

            if not os.path.exists(output_path):
                print(json.dumps({"error": "File not created", "path": output_path}))
                sys.exit(1)

            print(json.dumps({
                "id": target.id,
                "title": target.title,
                "type_id": kind,
                "file_path": output_path,
                "filename": filename,
                "found": True,
            }))
    except Exception as e:
        import traceback
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)

asyncio.run(main())

import sys, time
t0 = time.time()
sys.stdout.write(f'{time.time()-t0:.1f}s: start\n'); sys.stdout.flush()
from notebooklm._logging import configure_logging
configure_logging()
sys.stdout.write(f'{time.time()-t0:.1f}s: logging\n'); sys.stdout.flush()
from notebooklm.auth import load_client_auth
sys.stdout.write(f'{time.time()-t0:.1f}s: auth imported\n'); sys.stdout.flush()
auth = load_client_auth()
sys.stdout.write(f'{time.time()-t0:.1f}s: auth loaded\n'); sys.stdout.flush()
from notebooklm.client import NotebookLMClient
sys.stdout.write(f'{time.time()-t0:.1f}s: client imported\n'); sys.stdout.flush()
import asyncio
sys.stdout.write(f'{time.time()-t0:.1f}s: asyncio imported\n'); sys.stdout.flush()

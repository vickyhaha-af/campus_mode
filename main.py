"""Entry-point shim for hosts that run `uvicorn main:app` from the repo root.

Some PaaS hosts (Render in particular) run a fixed startCommand of
`uvicorn main:app` regardless of what `render.yaml` says, because dashboard
settings override blueprint config once a service exists. This shim makes
both invocation patterns work:

    uvicorn main:app                        # from repo root (hits this file)
    uvicorn --app-dir backend main:app      # loads backend/main.py directly

Both produce the same ASGI `app` object.
"""
from __future__ import annotations

import importlib.util
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.join(_HERE, "backend")

# Put backend/ on sys.path so backend/main.py's own imports (`from config import...`
# etc.) resolve.
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# Load backend/main.py by explicit file path — using a distinct module name
# so it does NOT collide with this shim (both files are called main.py).
_spec = importlib.util.spec_from_file_location(
    "backend_main_entry",
    os.path.join(_BACKEND, "main.py"),
)
if _spec is None or _spec.loader is None:
    raise RuntimeError("Could not locate backend/main.py from entry-point shim")
_backend_main = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_backend_main)

app = _backend_main.app

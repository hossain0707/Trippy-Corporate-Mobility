"""DEV-only frontend and API behind the existing Cloud Run IAP access policy.

Preserves FastAPI routes, authorized account checks and the IAP perimeter.
No production source uses this module.
"""
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from .main import app

app.mount("/", StaticFiles(directory=Path(__file__).resolve().parent.parent / "web", html=True))

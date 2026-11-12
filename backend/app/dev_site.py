"""Serve the dev frontend and API behind the same access policy."""

from pathlib import Path

from fastapi.staticfiles import StaticFiles

from .main import app

# Register the static mount after the API routes so they take precedence.
app.mount("/", StaticFiles(directory=Path(__file__).resolve().parent.parent / "web", html=True))

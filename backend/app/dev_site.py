"""DEV-only frontend and API behind the existing Cloud Run IAP access policy.

Preserves FastAPI routes, authorized account checks and the IAP perimeter.
No production source uses this module.
"""
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from .main import app

@app.middleware("http")
async def forward_app_authorization(request, call_next):
    # Keep the browser's IAP cookie and the app's independently verified token separate.
    app_authorization = request.headers.get("x-trippy-authorization")
    if request.url.path.startswith("/api/") and app_authorization:
        headers = [
            (name, value) for name, value in request.scope["headers"]
            if name not in (b"authorization", b"x-trippy-authorization")
        ]
        request.scope["headers"] = [*headers, (b"authorization", app_authorization.encode("latin-1"))]
    return await call_next(request)


app.mount("/", StaticFiles(directory=Path(__file__).resolve().parent.parent / "web", html=True))

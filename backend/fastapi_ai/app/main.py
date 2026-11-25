from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import settings

app = FastAPI(title="NutriVision AI", version="1.0.0", docs_url=None, redoc_url=None)
app.include_router(router)


@app.middleware("http")
async def request_limits(request: Request, call_next):
    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) > settings().max_image_bytes + 65536:
                return JSONResponse({"detail": "Request exceeds the image upload limit."}, status_code=413)
        except ValueError:
            return JSONResponse({"detail": "Invalid Content-Length."}, status_code=400)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/health")
def health():
    return {"status": "ok", "service": "nutrivision-ai"}

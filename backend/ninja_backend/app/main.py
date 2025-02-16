from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.api.v1 import router as api_router

app = FastAPI(title="Ninja Social Coach")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

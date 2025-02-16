from fastapi import APIRouter

from app.api.v1 import messages

router = APIRouter()
router.include_router(messages.router, prefix="/messages", tags=["messages"])

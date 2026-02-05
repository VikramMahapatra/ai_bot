from uuid import UUID

from fastapi import APIRouter, BackgroundTasks
from app.sync.full_sync import run_full_sync

router = APIRouter(
    prefix="/api",
    tags=["Sync"],
)

@router.post("/sync/{shop_id}")
async def sync_shop(shop_id: UUID, bg: BackgroundTasks):
    bg.add_task(run_full_sync, shop_id)
    return {"status": "sync started"}

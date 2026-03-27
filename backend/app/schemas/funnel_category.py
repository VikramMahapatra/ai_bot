from datetime import datetime
from pydantic import BaseModel, Field


class FunnelCategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    key: str = Field(min_length=1, max_length=120)
    color: str = Field(default="#4e89d5", min_length=4, max_length=16)
    position: int = Field(default=0, ge=0)
    is_active: bool = True


class FunnelCategoryCreate(FunnelCategoryBase):
    pass


class FunnelCategoryUpdate(FunnelCategoryBase):
    pass


class FunnelCategoryResponse(FunnelCategoryBase):
    id: int
    organization_id: int
    created_at: datetime

    class Config:
        from_attributes = True

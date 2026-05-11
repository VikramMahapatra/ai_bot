from typing import Optional

from pydantic import BaseModel


class ChannelCreate(BaseModel):
    name: str
    is_active: bool


class ChannelUpdate(ChannelCreate):
    pass


class ChannelResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    organization: str

    class Config:
        from_attributes = True


class ChannelRequest(BaseModel):
    search: Optional[str] = None
    skip: Optional[int] = None
    limit: Optional[int] = None

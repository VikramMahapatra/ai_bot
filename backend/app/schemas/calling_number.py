from typing import Optional

from pydantic import BaseModel


class CallingNumberCreate(BaseModel):
    phone_number: str
    type: str
    country_code: str
    provider: Optional[str] = None
    is_active: bool


class CallingNumberUpdate(CallingNumberCreate):
    pass


class CallingNumberResponse(BaseModel):
    id: int
    phone_number: str
    type: str
    country_code: str
    provider: Optional[str] = None
    is_active: bool
    organizations: str

    class Config:
        from_attributes = True


class CallingNumberRequest(BaseModel):
    search: Optional[str] = None
    skip: Optional[int] = None
    limit: Optional[int] = None

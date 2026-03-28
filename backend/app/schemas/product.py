from typing import Optional

from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    
class ProductUpdate(ProductCreate):
   pass
    
class ProductResponse(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str]
    is_deleted: bool

    class Config:
        from_attributes = True
        
        
class ProductRequest(BaseModel):
    search: Optional[str] = None
    skip: Optional[int] = None
    limit: Optional[int] = None
   
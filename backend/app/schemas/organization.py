from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from app.models.user import UserRole


class OrganizationCreate(BaseModel):
    name: str
    description: Optional[str] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_meet_link: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    default_meet_link: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.USER
    assigned_widget_ids: Optional[List[str]] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    assigned_widget_ids: Optional[List[str]] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    organization_id: int
    is_active: bool
    assigned_widget_ids: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserDetailResponse(UserResponse):
    organization: Optional[OrganizationResponse] = None


class UserListResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    organization_id: int
    is_active: bool
    assigned_widget_ids: List[str] = Field(default_factory=list)
    created_at: datetime

    class Config:
        from_attributes = True
        
class AgentReport(BaseModel):
    name: str
    external_agent_name: Optional[str]
    external_agent_id: Optional[str]


class CampaignReport(BaseModel):
    name: str
    external_campaign_name: Optional[str]
    external_campaign_id: Optional[int]


class OrganizationReport(BaseModel):
    organization_id: int
    organization_name: str

    agents_created: int
    agent_limit: Optional[int]

    campaign_created: int
    campaign_limit: Optional[int]

    calls_done: int
    calls_limit: Optional[int]

    agents: List[AgentReport]
    campaigns: List[CampaignReport]
    
    
class CreditParameters(BaseModel):
    feature_code: str
    required_credits: Optional[float] = None
    quantity: Optional[float] = None
    reference_type: Optional[str] =None,
    reference_id: Optional[str] =None

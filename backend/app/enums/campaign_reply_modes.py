
from enum import Enum

class CampaignInstantReplyMode(str, Enum):
    whatsapp = "whatsapp"
    sms = "sms"
    email = "email"
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    # App Metadata / Runtime
    APP_TITLE: str
    APP_DESCRIPTION: str
    APP_VERSION: str
    LOG_LEVEL: str
    LOG_FORMAT: str
    UVICORN_HOST: str
    UVICORN_PORT: int
    PUBLIC_APP_URL: str

    # OpenAI Configuration
    OPENAPI_KEY2: str
    OPENAI_CHAT_MODEL: str
    OPENAI_TRANSLATION_MODEL: str
    EMBEDDING_MODEL: str
    USE_LOCAL_EMBEDDINGS: bool
    LOCAL_EMBEDDING_MODEL: str
    OPENAI_CHAT_TIMEOUT_SECONDS: int = 18
    OPENAI_STREAM_TIMEOUT_SECONDS: int = 25
    OPENAI_TRANSLATION_TIMEOUT_SECONDS: int = 20
    OUTCOME_CLASSIFICATION_MODEL: str
    OUTCOME_DAEMON_HOUR_UTC: int
    OUTCOME_DAEMON_MINUTE_UTC: int
    OUTCOME_DAEMON_INITIAL_DELAY_SECONDS: int
    OUTCOME_DAEMON_BATCH_SIZE: int
    OUTCOME_DAEMON_MAX_BATCHES: int
    META_APP_ID: str = ""
    META_APP_SECRET: str
    META_EMBEDDED_SIGNUP_CONFIG_ID: str = ""
    META_EMBEDDED_REDIRECT_URI: str = ""
    WHATSAPP_GRAPH_VERSION: str
    DEV_BYPASS_SUBSCRIPTION_CHECK: bool = False

    # Chat Escalation Defaults
    DEFAULT_ESCALATION_CONTACT_LEVEL_1: str
    DEFAULT_ESCALATION_CONTACT_LEVEL_2: str
    HUMAN_HANDOFF_DISTANCE_THRESHOLD: float = 0.65
    HUMAN_HANDOFF_NO_ANSWER_PATTERNS: str = "i don't know|i do not know|don't have a reliable answer|unable to answer|no relevant context found|knowledge base doesn't contain|don't have reliable expertise|escalation contacts|would you like me to connect you"
    HUMAN_HANDOFF_WAITING_MESSAGE: str = "I am connecting you to a human expert. Please share any additional details and we will respond shortly."
    HUMAN_HANDOFF_WAIT_TIMEOUT_SECONDS: int = 120
    HUMAN_HANDOFF_MAX_WAIT_CYCLES: int = 2
    HUMAN_HANDOFF_BUSY_MESSAGE: str = "Live users are currently busy. Do you want to wait for 2 more minutes while I try again, or would you like to schedule a meeting and I will set it up for you?"
    HUMAN_HANDOFF_FINAL_TIMEOUT_MESSAGE: str = "Live users are still busy, so I am moving you back to the bot. I can help you set up a meeting now, or you can type exit to end this chat session."

    # Reporting Defaults
    TOKEN_COST_PROMPT_PER_1K: float
    TOKEN_COST_COMPLETION_PER_1K: float
    
    # Database Configuration
    CHROMA_PERSIST_DIR: str
    UPLOAD_DIR: str
    EXPORT_DIR: str
    
    # JWT Configuration
    JWT_SECRET: str
    JWT_ALGORITHM: str
    JWT_EXPIRATION_MINUTES: int
    TEST_LINK_EXPIRY_HOURS: int = 24
    
    # CORS Configuration
    CORS_ORIGINS: str
    CORS_ALLOW_ORIGIN_REGEX: str
    CORS_ALLOW_CREDENTIALS: bool
    CORS_ALLOW_METHODS: str
    CORS_ALLOW_HEADERS: str
    
    # Email Configuration
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    SMTP_USE_SSL: bool
    EMAIL_SENDER: str
    CAMPAIGN_EMAIL_RCPT_CHECK: bool = True
    CAMPAIGN_EMAIL_RCPT_CHECK_TIMEOUT_SECONDS: int = 10
    CAMPAIGN_EMAIL_TRACKING_BASE_URL: str = "http://localhost:8000"
    CAMPAIGN_EMAIL_WEBHOOK_SECRET: str = ""

    # Twilio SMS defaults (used for bootstrap/testing)
    TWILIO_SMS_DEFAULT_ACCOUNT_SID: str = ""
    TWILIO_SMS_DEFAULT_AUTH_TOKEN: str = ""
    TWILIO_SMS_DEFAULT_FROM_NUMBER: str = ""
    TWILIO_SMS_DEFAULT_INBOUND_NUMBER: str = ""
    TWILIO_SMS_DEFAULT_LOCATION_LABEL: str = ""
    TWILIO_SMS_DEFAULT_VOICE_WEBHOOK_URL: str = ""
    TWILIO_SMS_DEFAULT_MESSAGING_WEBHOOK_URL: str = ""

    # Frontend URLs used in notifications
    FRONTEND_DASHBOARD_LEADS_URL: str
    
    # Echo Lead Keys
    ECHOL_API_BASE_URL: str
    ECHOL_API_KEY: str
    
    CAN_AUTO_SYNC_CAMPAIGN_LEAD: bool = False
    
    DB_USER: str 
    DB_PASS: str
    DB_HOST: str 
    DB_PORT: str 
    DB_SSLMODE: str 
    DB_NAME: str 
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def cors_allow_methods_list(self) -> List[str]:
        return [method.strip() for method in self.CORS_ALLOW_METHODS.split(",") if method.strip()]

    @property
    def cors_allow_headers_list(self) -> List[str]:
        return [header.strip() for header in self.CORS_ALLOW_HEADERS.split(",") if header.strip()]

    @property
    def handoff_no_answer_patterns_list(self) -> List[str]:
        return [item.strip().lower() for item in self.HUMAN_HANDOFF_NO_ANSWER_PATTERNS.split("|") if item.strip()]
    
    
    @property
    def DATABASE_URL(self) -> str:
        """Generate full Postgres URL dynamically"""
        base_url = f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        if self.DB_SSLMODE:
            base_url += f"?sslmode={self.DB_SSLMODE}"
        return base_url

    model_config = SettingsConfigDict(
        env_file=(str(BASE_DIR / ".env.example"), str(BASE_DIR / ".env")),
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()


def build_db_url(db_name: str) -> str:
    base_url = (
        f"postgresql+psycopg2://"
        f"{settings.DB_USER}:{settings.DB_PASS}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/{db_name}"
    )

    # append ssl only if provided
    if settings.DB_SSLMODE:
        base_url += f"?sslmode={settings.DB_SSLMODE}"

    return base_url

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # OpenAI Configuration
    OPENAPI_KEY2: str
    EMBEDDING_MODEL: str = "text-embedding-ada-002"
    USE_LOCAL_EMBEDDINGS: bool = True
    LOCAL_EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    
    # Database Configuration
    DATABASE_URL: str = "sqlite:///./chatbot.db"
    CHROMA_PERSIST_DIR: str = "./data/chroma"
    UPLOAD_DIR: str = "./data/uploads"
    EXPORT_DIR: str = "./data/exports"
    
    # JWT Configuration
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 10080  # 1 week
    
    # CORS Configuration
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

from typing import List
import logging
from app.config import settings
from chromadb.api.types import EmbeddingFunction

logger = logging.getLogger(__name__)


class LocalEmbeddingFunction(EmbeddingFunction):
    """Chroma-compatible embedding function using sentence-transformers"""
    def __init__(self):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as e:
            logger.error(f"sentence-transformers not available: {e}")
            raise
        
        self.model = SentenceTransformer(settings.LOCAL_EMBEDDING_MODEL)
    
    def __call__(self, input: List[str]) -> List[List[float]]:
        vectors = self.model.encode(input, normalize_embeddings=True)
        return [v.tolist() for v in vectors]


class OpenAIEmbeddingFunction(EmbeddingFunction):
    """Chroma-compatible embedding function using OpenAI"""
    def __init__(self):
        try:
            from openai import OpenAI
        except ImportError as e:
            logger.error(f"OpenAI SDK not available: {e}")
            raise
        
        self.client = OpenAI(api_key=settings.OPENAPI_KEY2)
        self.model_name = settings.EMBEDDING_MODEL
    
    def __call__(self, input: List[str]) -> List[List[float]]:
        try:
            response = self.client.embeddings.create(model=self.model_name, input=input)
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"Error generating OpenAI embeddings: {e}")
            raise


def get_embedding_function() -> EmbeddingFunction:
    """Return a Chroma-compatible embedding function.
    
    Prefers local sentence-transformers when `USE_LOCAL_EMBEDDINGS` is True;
    otherwise uses OpenAI embeddings with the configured model.
    """
    if settings.USE_LOCAL_EMBEDDINGS:
        try:
            return LocalEmbeddingFunction()
        except Exception:
            logger.warning("Local embeddings unavailable; falling back to OpenAI.")
            return OpenAIEmbeddingFunction()
    else:
        return OpenAIEmbeddingFunction()


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts (for backward compatibility)"""
    embedder = get_embedding_function()
    return embedder(texts)


def generate_embedding(text: str) -> List[float]:
    """Generate embedding for a single text (for backward compatibility)"""
    embeddings = generate_embeddings([text])
    return embeddings[0] if embeddings else []

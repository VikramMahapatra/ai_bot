from openai import OpenAI
from app.config import settings
from typing import List
import logging

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts using OpenAI"""
    try:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=texts
        )
        return [item.embedding for item in response.data]
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        raise


def generate_embedding(text: str) -> List[float]:
    """Generate embedding for a single text"""
    embeddings = generate_embeddings([text])
    return embeddings[0] if embeddings else []

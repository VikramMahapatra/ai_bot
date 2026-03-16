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
        self.max_tokens_per_request = 250000
        self.max_items_per_request = 128

        # Optional precise token counting when tiktoken is available.
        self._token_encoder = None
        try:
            import tiktoken
            self._token_encoder = tiktoken.encoding_for_model(self.model_name)
        except Exception:
            self._token_encoder = None

    def _estimate_tokens(self, text: str) -> int:
        if not text:
            return 1
        if self._token_encoder:
            try:
                return max(1, len(self._token_encoder.encode(text)))
            except Exception:
                pass
        # Conservative approximation for fallback.
        return max(1, len(text) // 4)

    def _batch_inputs(self, texts: List[str]) -> List[List[str]]:
        batches: List[List[str]] = []
        current_batch: List[str] = []
        current_tokens = 0

        for text in texts:
            estimated_tokens = self._estimate_tokens(text)

            # Protect against pathological oversized single inputs.
            if estimated_tokens > self.max_tokens_per_request:
                text = text[: self.max_tokens_per_request * 3]
                estimated_tokens = self._estimate_tokens(text)

            should_flush = (
                current_batch
                and (
                    len(current_batch) >= self.max_items_per_request
                    or current_tokens + estimated_tokens > self.max_tokens_per_request
                )
            )

            if should_flush:
                batches.append(current_batch)
                current_batch = []
                current_tokens = 0

            current_batch.append(text)
            current_tokens += estimated_tokens

        if current_batch:
            batches.append(current_batch)

        return batches
    
    def __call__(self, input: List[str]) -> List[List[float]]:
        try:
            if not input:
                return []

            vectors: List[List[float]] = []
            for batch in self._batch_inputs(input):
                response = self.client.embeddings.create(model=self.model_name, input=batch)
                vectors.extend(item.embedding for item in response.data)
            return vectors
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

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol, Sequence, Tuple, runtime_checkable


@runtime_checkable
class VectorStoreClient(Protocol):
    def query(
        self,
        query_text: str,
        n_results: int = 5,
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        widget_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        ...

    def get_documents(
        self,
        organization_id: Optional[int] = None,
        user_id: Optional[int] = None,
        widget_id: Optional[str] = None,
        include_documents: bool = False,
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        ...


@runtime_checkable
class CacheProvider(Protocol):
    def get(self, key: str) -> Optional[Any]:
        ...

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        ...

    def delete(self, key: str) -> None:
        ...


@runtime_checkable
class LLMProvider(Protocol):
    def generate_structured_answer(
        self,
        messages: Sequence[Dict[str, str]],
        model: str,
        max_tokens: int,
        temperature: float,
        timeout_seconds: float,
    ) -> Tuple[Dict[str, Any], Dict[str, int]]:
        ...

    def stream_chat_completion(
        self,
        messages: Sequence[Dict[str, str]],
        model: str,
        max_tokens: int,
        temperature: float,
        timeout_seconds: float,
    ) -> Any:
        ...

    def translate_text(
        self,
        text: str,
        target_language_code: Optional[str],
        target_language_label: Optional[str],
    ) -> str:
        ...


@dataclass(frozen=True)
class RerankedChunk:
    text: str
    stage: str
    rank: int
    distance: Optional[float] = None
    source_id: Optional[int] = None
    source_label: Optional[str] = None
    url: Optional[str] = None
    chunk_index: Optional[int] = None
    lexical_score: float = 0.0
    semantic_score: float = 0.0
    rerank_score: float = 0.0
    confidence: float = 0.0
    overlap: float = 0.0
    is_suspicious: bool = False
    snippet: Optional[str] = None


@dataclass(frozen=True)
class RetrievalConfidence:
    score: float
    label: str
    requires_clarification: bool = False
    reasons: Tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class HybridRetrievalResult:
    query_text: str
    chunks: List[RerankedChunk]
    confidence: RetrievalConfidence
    retrieval_trace: Dict[str, Any]
    sources: List[Dict[str, Any]]
    context_text: str


@dataclass(frozen=True)
class StructuredAnswer:
    answered: bool
    confidence: float
    requires_escalation: bool
    response: str
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ValidatedResponse:
    accepted: bool
    response: str
    confidence: float
    similarity: float
    reason: str = ""
    requires_clarification: bool = False


@dataclass(frozen=True)
class ChatResponsePlan:
    should_generate_llm_response: bool
    override_response: Optional[str]
    escalation_triggered: bool
    grounded_fallback: Optional[str]
    retrieval_trace: Dict[str, Any]
    sources: List[Dict[str, Any]]
    messages: List[Dict[str, str]]
    retrieval_result: Optional[HybridRetrievalResult] = None


@dataclass(frozen=True)
class FollowupContext:
    query_text: str
    history_message: Optional[str]
    history_response: Optional[str]
    overlap: float
    is_referential: bool


@dataclass(frozen=True)
class CreditReservation:
    usage_id: int
    organization_id: int
    feature_code: str
    quantity: float
    credits_reserved: float
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None

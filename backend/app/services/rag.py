import chromadb
from chromadb.config import Settings as ChromaSettings
from app.config import settings
from app.services.embeddings import get_embedding_function
from typing import List, Dict
import logging
import os

logger = logging.getLogger(__name__)


def _empty_query_result() -> Dict:
    return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}


def _is_embedding_auth_or_config_error(error_text: str) -> bool:
    normalized = (error_text or "").lower()
    markers = (
        "incorrect api key provided",
        "invalid_api_key",
        '"http/1.1 401 unauthorized"',
        "error code: 401",
        "authenticationerror",
        "api key",
    )
    return any(marker in normalized for marker in markers)


class ChromaDBClient:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ChromaDBClient, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # Ensure directory exists
        persist_dir = os.path.join(os.getcwd(), settings.CHROMA_PERSIST_DIR)
        os.makedirs(persist_dir, exist_ok=True)
        
        self.client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        
        # Prepare embedding function (OpenAI or local)
        self.embedding_function = get_embedding_function()

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="knowledge_base",
            metadata={"hnsw:space": "cosine"},
            embedding_function=self.embedding_function
        )
        
        logger.info("✅ ChromaDB client initialized")
        self._initialized = True
    
    def add_documents(self, documents: List[str], metadatas: List[Dict], ids: List[str]):
        """Add documents to ChromaDB; embeddings computed via embedding_function"""
        try:
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Added {len(documents)} documents to ChromaDB")
        except Exception as e:
            logger.error(f"Error adding documents to ChromaDB: {str(e)}")
            raise
    
    def query(self, query_text: str, n_results: int = 5, user_id: int = None, organization_id: int = None, widget_id: str = None) -> Dict:
        """Query ChromaDB for relevant documents, optionally filtered by organization, widget, and user."""
        try:
            query_params = {
                "query_texts": [query_text],
                "n_results": n_results
            }

            # Build where clause with proper ChromaDB syntax
            conditions = []
            if organization_id is not None:
                conditions.append({"organization_id": str(organization_id)})
            if user_id is not None:
                conditions.append({"user_id": str(user_id)})
            if widget_id is not None:
                conditions.append({"widget_id": str(widget_id)})

            # ChromaDB requires $and operator when multiple conditions
            if len(conditions) > 1:
                query_params["where"] = {"$and": conditions}
            elif len(conditions) == 1:
                query_params["where"] = conditions[0]

            results = self.collection.query(**query_params)
            return results
        except Exception as e:
            error_text = str(e)
            if "dimension" in error_text.lower() and "does not match" in error_text.lower():
                logger.error(
                    "Chroma embedding dimension mismatch detected. "
                    "This usually happens when switching embedding backends without rebuilding the collection. "
                    "Returning empty results to avoid request failure. Error: %s",
                    error_text,
                )
                return _empty_query_result()

            if _is_embedding_auth_or_config_error(error_text):
                logger.error(
                    "OpenAI embeddings are unavailable during Chroma query. "
                    "Set backend/.env OPENAPI_KEY2 to a valid key or enable local embeddings. "
                    "Returning empty retrieval results to keep the request alive. Error: %s",
                    error_text,
                )
                return _empty_query_result()

            logger.error(f"Error querying ChromaDB: {error_text}")
            raise
    
    def delete_by_source_id(self, source_id: int):
        """Delete all documents for a specific source"""
        try:
            # Get all documents with this source_id
            results = self.collection.get(
                where={"source_id": str(source_id)}
            )
            
            if results and results['ids']:
                self.collection.delete(ids=results['ids'])
                logger.info(f"Deleted {len(results['ids'])} documents for source {source_id}")
        except Exception as e:
            logger.error(f"Error deleting documents from ChromaDB: {str(e)}")
            raise

    def delete_by_source_id_and_url(self, source_id: int, url: str):
        """Delete documents for a specific source and URL"""
        try:
            results = self.collection.get(
                where={"$and": [{"source_id": str(source_id)}, {"url": url}]}
            )
            if results and results['ids']:
                self.collection.delete(ids=results['ids'])
                logger.info(f"Deleted {len(results['ids'])} documents for source {source_id} url {url}")
        except Exception as e:
            logger.error(f"Error deleting documents for source/url from ChromaDB: {str(e)}")
            raise
    
    def get_documents(
        self,
        organization_id: int = None,
        user_id: int = None,
        widget_id: str = None,
        include_documents: bool = False,
        limit: int = None,
    ) -> Dict:
        """Get documents filtered by organization, widget, and/or user."""
        try:
            # Build where clause with proper ChromaDB syntax
            conditions = []
            if organization_id is not None:
                conditions.append({"organization_id": str(organization_id)})
            if user_id is not None:
                conditions.append({"user_id": str(user_id)})
            if widget_id is not None:
                conditions.append({"widget_id": widget_id})  # widget_id is already a string

            # ChromaDB requires $and operator when multiple conditions
            where_clause = None
            if len(conditions) > 1:
                where_clause = {"$and": conditions}
            elif len(conditions) == 1:
                where_clause = conditions[0]

            logger.info(f"Querying ChromaDB with where_clause: {where_clause}")

            query_kwargs = {}
            if where_clause:
                query_kwargs["where"] = where_clause
            if limit is not None and limit > 0:
                query_kwargs["limit"] = int(limit)
            query_kwargs["include"] = ["metadatas", "documents"] if include_documents else ["metadatas"]

            if where_clause:
                results = self.collection.get(**query_kwargs)
            else:
                # If no filters, get all documents
                results = self.collection.get(**query_kwargs)
            
            logger.info(f"ChromaDB query returned {len(results.get('ids', []))} documents")
            return results
        except Exception as e:
            logger.error(f"Error getting documents from ChromaDB: {str(e)}", exc_info=True)
            # Return empty results on error instead of raising
            return {"ids": [], "metadatas": [], "documents": []}


# Singleton instance
chroma_client = ChromaDBClient()
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.config import settings
from app.services.embeddings import generate_embedding
from typing import List, Dict
import logging
import os

logger = logging.getLogger(__name__)


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
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )
        
        self._initialized = True
    
    def add_documents(self, documents: List[str], metadatas: List[Dict], ids: List[str]):
        """Add documents to ChromaDB with embeddings"""
        try:
            # Generate embeddings
            embeddings = []
            for doc in documents:
                embedding = generate_embedding(doc)
                embeddings.append(embedding)
            
            # Add to collection
            self.collection.add(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Added {len(documents)} documents to ChromaDB")
        except Exception as e:
            logger.error(f"Error adding documents to ChromaDB: {str(e)}")
            raise
    
    def query(self, query_text: str, n_results: int = 5) -> Dict:
        """Query ChromaDB for relevant documents"""
        try:
            # Generate query embedding
            query_embedding = generate_embedding(query_text)
            
            # Query collection
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results
            )
            
            return results
        except Exception as e:
            logger.error(f"Error querying ChromaDB: {str(e)}")
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


# Singleton instance
chroma_client = ChromaDBClient()

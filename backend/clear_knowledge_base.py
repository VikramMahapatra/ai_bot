"""Clear all knowledge sources and ChromaDB embeddings."""
import sqlite3
import chromadb
from pathlib import Path
import shutil

def main():
    print("⚠️  WARNING: This will delete ALL knowledge sources and embeddings!")
    print("=" * 60)
    
    # 1. Clear knowledge_sources table
    conn = sqlite3.connect('chatbot.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM knowledge_sources")
    count = cursor.fetchone()[0]
    print(f"\n📊 Found {count} knowledge sources in database")
    
    if count > 0:
        cursor.execute("DELETE FROM knowledge_sources")
        conn.commit()
        print(f"✅ Deleted {count} knowledge sources from database")
    
    conn.close()
    
    # 2. Clear ChromaDB
    chroma_dir = Path(__file__).parent / "data" / "chroma"
    
    if chroma_dir.exists():
        try:
            # Connect to ChromaDB
            chroma_client = chromadb.PersistentClient(path=str(chroma_dir))
            
            # Try to get and delete the collection
            try:
                collection = chroma_client.get_collection("knowledge_base")
                doc_count = collection.count()
                print(f"\n📚 Found {doc_count} documents in ChromaDB")
                
                # Delete the entire collection
                chroma_client.delete_collection("knowledge_base")
                print(f"✅ Deleted knowledge_base collection from ChromaDB")
                
                # Recreate empty collection
                from app.services.embeddings import get_embedding_function
                embedding_function = get_embedding_function()
                chroma_client.create_collection(
                    name="knowledge_base",
                    metadata={"hnsw:space": "cosine"},
                    embedding_function=embedding_function
                )
                print(f"✅ Recreated empty knowledge_base collection")
                
            except Exception as e:
                print(f"⚠️  ChromaDB collection error: {e}")
        
        except Exception as e:
            print(f"❌ Error accessing ChromaDB: {e}")
    else:
        print(f"⚠️  ChromaDB directory not found: {chroma_dir}")
    
    print(f"\n{'='*60}")
    print("🎉 Cleanup complete!")
    print("   - Knowledge sources table cleared")
    print("   - ChromaDB embeddings cleared")

if __name__ == "__main__":
    main()

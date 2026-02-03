"""Clear all data except users, organizations, and widgets."""
import sqlite3
import chromadb
from pathlib import Path

def main():
    print("⚠️  WARNING: This will clear data from all tables except users, organizations, and widgets!")
    print("=" * 60)
    
    conn = sqlite3.connect('chatbot.db')
    cursor = conn.cursor()
    
    # Get list of all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    all_tables = [row[0] for row in cursor.fetchall()]
    
    # Tables to preserve
    preserve_tables = ['users', 'organizations', 'widget_configs']
    
    # Tables to clear
    tables_to_clear = [t for t in all_tables if t not in preserve_tables and not t.startswith('sqlite_')]
    
    print(f"\n📋 Tables that will be cleared:")
    for table in tables_to_clear:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"  - {table}: {count} rows")
    
    print(f"\n✅ Tables that will be preserved:")
    for table in preserve_tables:
        if table in all_tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"  - {table}: {count} rows")
    
    # Clear each table
    print(f"\n🗑️  Clearing tables...")
    for table in tables_to_clear:
        try:
            cursor.execute(f"DELETE FROM {table}")
            print(f"  ✅ Cleared {table}")
        except Exception as e:
            print(f"  ❌ Error clearing {table}: {e}")
    
    conn.commit()
    
    # Clear ChromaDB
    print(f"\n📚 Clearing ChromaDB...")
    chroma_dir = Path(__file__).parent / "data" / "chroma"
    
    if chroma_dir.exists():
        try:
            chroma_client = chromadb.PersistentClient(path=str(chroma_dir))
            
            try:
                collection = chroma_client.get_collection("knowledge_base")
                doc_count = collection.count()
                print(f"  Found {doc_count} documents in ChromaDB")
                
                chroma_client.delete_collection("knowledge_base")
                print(f"  ✅ Deleted knowledge_base collection")
                
                # Recreate empty collection
                from app.services.embeddings import get_embedding_function
                embedding_function = get_embedding_function()
                chroma_client.create_collection(
                    name="knowledge_base",
                    metadata={"hnsw:space": "cosine"},
                    embedding_function=embedding_function
                )
                print(f"  ✅ Recreated empty knowledge_base collection")
                
            except Exception as e:
                print(f"  ⚠️  ChromaDB collection error: {e}")
        
        except Exception as e:
            print(f"  ❌ Error accessing ChromaDB: {e}")
    
    conn.close()
    
    print(f"\n{'='*60}")
    print("🎉 Cleanup complete!")
    print("   ✅ Users preserved")
    print("   ✅ Organizations preserved")
    print("   ✅ Widgets preserved")
    print("   🗑️  All other data cleared")

if __name__ == "__main__":
    main()

"""Debug widget_id mismatch between database and ChromaDB."""
import chromadb
from pathlib import Path
import sqlite3

def main():
    conn = sqlite3.connect('chatbot.db')
    cursor = conn.cursor()
    
    # Get Widget 1 sources
    cursor.execute("""
        SELECT id, name, organization_id 
        FROM knowledge_sources 
        WHERE widget_id = 1
    """)
    widget1_sources = cursor.fetchall()
    
    print("Widget 1 Knowledge Sources in Database:")
    for sid, name, org_id in widget1_sources:
        print(f"  ID {sid}: {name} (org {org_id})")
    
    # Check ChromaDB
    chroma_dir = Path(__file__).parent / "data" / "chroma"
    chroma_client = chromadb.PersistentClient(path=str(chroma_dir))
    collection = chroma_client.get_collection("knowledge_base")
    
    all_data = collection.get(include=['metadatas'])
    
    # Find unique source_ids in ChromaDB
    source_ids = set()
    for metadata in all_data['metadatas']:
        if metadata and 'source_id' in metadata:
            source_ids.add(metadata['source_id'])
    
    print(f"\nUnique source_ids in ChromaDB: {sorted(source_ids)}")
    
    # Check which Widget 1 sources are in ChromaDB
    widget1_ids = {str(sid) for sid, _, _ in widget1_sources}
    print(f"\nWidget 1 source IDs: {sorted(widget1_ids)}")
    print(f"In ChromaDB: {sorted(widget1_ids & source_ids)}")
    print(f"Not in ChromaDB: {sorted(widget1_ids - source_ids)}")
    
    conn.close()

if __name__ == "__main__":
    main()

"""Backfill widget_id in ChromaDB metadata for existing embeddings."""
import chromadb
from pathlib import Path
import sqlite3

def main():
    # Connect to ChromaDB
    chroma_dir = Path(__file__).parent / "data" / "chroma"
    chroma_client = chromadb.PersistentClient(path=str(chroma_dir))
    
    try:
        collection = chroma_client.get_collection("knowledge_base")
    except Exception as e:
        print(f"Could not get knowledge_base collection: {e}")
        return
    
    # Connect to SQLite to get widget_id mappings
    conn = sqlite3.connect('chatbot.db')
    cursor = conn.cursor()
    
    # Get all knowledge sources with widget_id
    cursor.execute("""
        SELECT id, widget_id, organization_id, name
        FROM knowledge_sources 
        WHERE widget_id IS NOT NULL
    """)
    sources = cursor.fetchall()
    
    print(f"Found {len(sources)} knowledge sources with widget_id\n")
    
    # Get all embeddings from ChromaDB
    all_data = collection.get(include=['metadatas'])
    total_docs = len(all_data['ids'])
    print(f"Total documents in ChromaDB: {total_docs}\n")
    
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    # For each document, check if it needs widget_id
    for i, (doc_id, metadata) in enumerate(zip(all_data['ids'], all_data['metadatas'])):
        if metadata:
            # Find matching knowledge source by source_id
            source_id = metadata.get('source_id')
            if source_id:
                # Find widget_id for this source
                matching = [s for s in sources if str(s[0]) == str(source_id)]
                if matching:
                    widget_id = matching[0][1]
                    org_id = matching[0][2]
                    
                    # Update metadata if widget_id is missing or different
                    needs_update = False
                    if 'widget_id' not in metadata:
                        needs_update = True
                    elif metadata.get('widget_id') != str(widget_id):
                        print(f"⚠️  Correcting widget_id for doc {doc_id}: {metadata.get('widget_id')} -> {widget_id}")
                        needs_update = True
                    
                    if needs_update:
                        try:
                            metadata['widget_id'] = str(widget_id)
                            # Ensure organization_id is also set
                            if 'organization_id' not in metadata:
                                metadata['organization_id'] = str(org_id)
                            
                            collection.update(
                                ids=[doc_id],
                                metadatas=[metadata]
                            )
                            updated_count += 1
                            if updated_count % 10 == 0:
                                print(f"Updated {updated_count} documents...")
                        except Exception as e:
                            print(f"Error updating {doc_id}: {e}")
                            error_count += 1
                    else:
                        skipped_count += 1
                else:
                    print(f"⚠️  No knowledge source found for source_id={source_id}")
                    skipped_count += 1
            else:
                print(f"⚠️  Document {doc_id} has no source_id in metadata")
                skipped_count += 1
        else:
            skipped_count += 1
    
    print(f"\n{'='*60}")
    print(f"ChromaDB backfill complete!")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Errors: {error_count}")
    
    conn.close()

if __name__ == "__main__":
    main()

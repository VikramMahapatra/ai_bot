"""Verify widget-scoped architecture is working correctly."""
import chromadb
from pathlib import Path
import sqlite3

def main():
    print("Widget-Scoped Architecture Verification")
    print("=" * 60)
    
    # 1. Check database
    conn = sqlite3.connect('chatbot.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM knowledge_sources WHERE widget_id IS NOT NULL")
    sources_with_widget = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM knowledge_sources")
    total_sources = cursor.fetchone()[0]
    
    print(f"\n📊 Database Status:")
    print(f"  Knowledge sources total: {total_sources}")
    print(f"  With widget_id: {sources_with_widget}")
    print(f"  Without widget_id: {total_sources - sources_with_widget}")
    
    # 2. Check widgets
    cursor.execute("SELECT id, organization_id, name FROM widget_configs")
    widgets = cursor.fetchall()
    print(f"\n🔧 Widgets:")
    for widget_id, org_id, name in widgets:
        cursor.execute("SELECT COUNT(*) FROM knowledge_sources WHERE widget_id = ?", (widget_id,))
        source_count = cursor.fetchone()[0]
        print(f"  Widget {widget_id} ({name}) - Org {org_id}: {source_count} knowledge sources")
    
    # 3. Check ChromaDB
    chroma_dir = Path(__file__).parent / "data" / "chroma"
    chroma_client = chromadb.PersistentClient(path=str(chroma_dir))
    
    try:
        collection = chroma_client.get_collection("knowledge_base")
        all_data = collection.get(include=['metadatas'])
        
        # Count by widget_id
        widget_counts = {}
        missing_widget_id = 0
        
        for metadata in all_data['metadatas']:
            if metadata and 'widget_id' in metadata:
                widget_id = metadata['widget_id']
                widget_counts[widget_id] = widget_counts.get(widget_id, 0) + 1
            else:
                missing_widget_id += 1
        
        print(f"\n🗄️  ChromaDB Status:")
        print(f"  Total documents: {len(all_data['ids'])}")
        print(f"  Documents by widget:")
        for widget_id, count in sorted(widget_counts.items()):
            print(f"    Widget {widget_id}: {count} documents")
        if missing_widget_id > 0:
            print(f"    Missing widget_id: {missing_widget_id} documents")
        
        # 4. Test widget isolation
        print(f"\n🔒 Testing Widget Isolation:")
        for widget_id in ['1', '2']:
            results = collection.query(
                query_texts=["product"],
                n_results=3,
                where={"widget_id": widget_id}
            )
            result_count = len(results['ids'][0]) if results['ids'] else 0
            print(f"  Widget {widget_id} query results: {result_count} documents")
        
    except Exception as e:
        print(f"\n⚠️  ChromaDB Error: {e}")
    
    print(f"\n{'='*60}")
    print("✅ Verification complete!")
    
    conn.close()

if __name__ == "__main__":
    main()

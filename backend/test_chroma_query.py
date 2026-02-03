"""Test ChromaDB query with multiple conditions."""
from app.services.rag import ChromaDBClient

def test_query():
    client = ChromaDBClient()
    
    # Test with both organization_id and widget_id
    print("Testing query with organization_id=3 and widget_id='widget_1769582231293'")
    try:
        results = client.query(
            query_text="test",
            organization_id=3,
            widget_id="widget_1769582231293",
            n_results=3
        )
        print(f"✅ Query successful! Found {len(results['ids'][0])} results")
    except Exception as e:
        print(f"❌ Query failed: {e}")
    
    # Test get_documents with multiple conditions
    print("\nTesting get_documents with organization_id=3 and widget_id='2'")
    try:
        results = client.get_documents(
            organization_id=3,
            widget_id="2"
        )
        print(f"✅ Get documents successful! Found {len(results['ids'])} documents")
    except Exception as e:
        print(f"❌ Get documents failed: {e}")

if __name__ == "__main__":
    test_query()

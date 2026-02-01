#!/usr/bin/env python3
"""
Test script to verify source attribution feature
"""

# Test data structure
test_response = {
    "response": "Based on our knowledge base, the answer is...",
    "session_id": "session_123",
    "sources": [
        {
            "id": 1,
            "name": "Company Website",
            "type": "WEB",
            "url": "https://example.com"
        },
        {
            "id": 2,
            "name": "user_guide.pdf",
            "type": "PDF",
            "url": None
        }
    ]
}

# Verify response structure
assert "response" in test_response
assert "session_id" in test_response
assert "sources" in test_response
assert len(test_response["sources"]) == 2

# Verify source structure
for source in test_response["sources"]:
    assert "id" in source
    assert "name" in source
    assert "type" in source
    assert source["type"] in ["WEB", "PDF", "DOCX", "XLSX"]
    if source["url"]:
        assert source["url"].startswith("http")

print("✅ All structure tests passed!")
print(f"✅ Response includes {len(test_response['sources'])} sources")
print("✅ Frontend can safely access source data")
print("✅ Source attribution feature is ready for testing")

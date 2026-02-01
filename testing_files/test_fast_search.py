import json
import httpx
import os
import asyncio
from dotenv import load_dotenv

# Load environment variables from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))

EXA_API_KEY = os.getenv("EXA_API_KEY")
EXA_API_URL = "https://api.exa.ai/search"

async def test_search():
    if not EXA_API_KEY:
        print("Error: EXA_API_KEY not found in backend/.env")
        return

    query = "coffee shops near Avenue des Champs-Élysées Paris"
    
    schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Coffee shop name"
            },
            "latitude": {
                "type": "number",
                "description": "Latitude coordinate"
            },
            "longitude": {
                "type": "number",
                "description": "Longitude coordinate"
            }
        },
        "required": ["name", "latitude", "longitude"]
    }
    
    payload = {
        "query": query,
        "type": "fast",
        "num_results": 7,
        "livecrawl": "never",
        "contents": {
            "summary": {
                "query": "Extract coffee shop name, latitude and longitude",
                "schema": schema
            }
        }
    }
    
    print(f"=== Testing Exa Fast Search ===")
    print(f"Query: {query}")
    print(f"Key: {EXA_API_KEY[:5]}...")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                EXA_API_URL,
                json=payload,
                headers={"x-api-key": EXA_API_KEY}
            )
            response.raise_for_status()
            data = response.json()
        
        print(f"\nRequest ID: {data.get('requestId')}")
        print("\nResults found:")
        
        for i, result in enumerate(data.get("results", []), 1):
            name = result.get("title", "Unknown")
            url = result.get("url", "No URL")
            summary_text = result.get("summary", "{}")
            
            print(f"\n{i}. {name}")
            print(f"   URL: {url}")
            try:
                summary = json.loads(summary_text)
                print(f"   Geo: {summary.get('latitude')}, {summary.get('longitude')}")
            except:
                print(f"   Summary: {summary_text[:100]}...")
                
    except Exception as e:
        print(f"\nError: {e}")

if __name__ == "__main__":
    asyncio.run(test_search())
    
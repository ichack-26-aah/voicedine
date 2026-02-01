import json
import httpx
import os
import asyncio
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))

EXA_API_KEY = os.getenv("EXA_API_KEY")
EXA_API_URL = "https://api.exa.ai/search"

# Paris center coordinates for validation
PARIS_LAT = 48.8566
PARIS_LON = 2.3522
GEO_TOLERANCE = 2.0  # +-2 degrees


def is_valid_location(lat: float, lon: float) -> bool:
    """Check if coordinates are within +-2 degrees of Paris"""
    return (
        abs(lat - PARIS_LAT) <= GEO_TOLERANCE
        and abs(lon - PARIS_LON) <= GEO_TOLERANCE
        and lat != 0.0
        and lon != 0.0
    )


async def test_expanded_fast_search():
    if not EXA_API_KEY:
        print("Error: EXA_API_KEY not found")
        return

    print("\n=== Starting Expanded Fast Search Test ===")

    query = "coffee shops near Avenue des Champs-Élysées Paris"

    schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "Restaurant/cafe name"},
            "latitude": {"type": "number", "description": "Latitude coordinate"},
            "longitude": {"type": "number", "description": "Longitude coordinate"},
            "address": {"type": "string", "description": "Full street address"},
            "cuisine": {"type": "string", "description": "Type of cuisine or cafe type"},
            "rating": {"type": "number", "description": "Rating out of 5"},
            "price_range": {"type": "string", "description": "Price range ($, $$, $$$)"},
            "highlights": {"type": "array", "items": {"type": "string"}, "description": "Notable features"}
        },
        "required": ["name", "latitude", "longitude"]
    }

    payload = {
        "query": query,
        "type": "fast",
        "num_results": 10,
        "livecrawl": "never",
        "contents": {
            "summary": {
                "query": "Extract name, address, cuisine type, rating, price range, and notable features",
                "schema": schema
            }
        }
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                EXA_API_URL,
                json=payload,
                headers={"x-api-key": EXA_API_KEY}
            )
            response.raise_for_status()
            data = response.json()

        # Filter results by geolocation
        valid_results = []
        for result in data.get("results", []):
            try:
                summary = json.loads(result.get("summary", "{}"))
                lat = summary.get("latitude", 0.0)
                lon = summary.get("longitude", 0.0)
                
                if is_valid_location(lat, lon):
                    valid_results.append(result)
            except json.JSONDecodeError:
                continue

        data["results"] = valid_results
        print(json.dumps(data, indent=2))

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(test_expanded_fast_search())

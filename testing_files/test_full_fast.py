import json
import httpx
import os
import asyncio
from dotenv import load_dotenv
from dataclasses import dataclass
from typing import Optional, List, Dict, Any


# Load environment variables from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))


EXA_API_KEY = os.getenv("EXA_API_KEY")
EXA_API_URL = "https://api.exa.ai/search"


@dataclass
class Geolocation:
    latitude: float
    longitude: float


@dataclass
class RestaurantResult:
    """Unified restaurant result model matching your UI expectations"""
    name: str
    url: str
    geolocation: Geolocation
    address: str = "Not available"
    cuisine: str = "Not specified"
    rating: float = 0.0
    match_score: float = 5.0
    match_criteria: List[str] = None
    price_range: str = "Unknown"

    def __post_init__(self):
        if self.match_criteria is None:
            self.match_criteria = []

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for API response"""
        return {
            "name": self.name,
            "address": self.address,
            "cuisine": self.cuisine,
            "rating": self.rating,
            "match_score": self.match_score,
            "match_criteria": self.match_criteria,
            "price_range": self.price_range,
            "url": self.url,
            "geolocation": {
                "latitude": self.geolocation.latitude,
                "longitude": self.geolocation.longitude,
            }
        }


class ExaFastSearchTransformer:
    """
    Transforms Exa Fast Search API responses to RestaurantResult format.
    Handles schema mismatch between raw API response and UI expectations.
    """

    @staticmethod
    def parse_summary(summary_text: str) -> Dict[str, Any]:
        """
        Parse the summary JSON string returned by Exa.
        Summary contains: name, latitude, longitude (from schema extraction)
        
        Args:
            summary_text: JSON string embedded in result
            
        Returns:
            Parsed dict with extracted fields, empty dict if parse fails
        """
        try:
            return json.loads(summary_text)
        except json.JSONDecodeError:
            print(f"⚠️  Failed to parse summary: {summary_text[:100]}...")
            return {}

    @staticmethod
    def transform_result(raw_result: Dict[str, Any]) -> RestaurantResult:
        """
        Transform raw Exa Fast Search result to RestaurantResult.
        
        Maps:
        - title → name
        - url → url
        - summary (JSON string) → geolocation (lat/long extraction)
        - Missing fields → safe defaults (address, cuisine, rating, etc.)
        
        Args:
            raw_result: Single result from Exa API response
            
        Returns:
            RestaurantResult with all fields populated or defaulted
        """
        title = raw_result.get("title", "Unknown Restaurant")
        url = raw_result.get("url", "")
        summary_text = raw_result.get("summary", "{}")

        # Parse the summary JSON string
        summary = ExaFastSearchTransformer.parse_summary(summary_text)

        # Extract geolocation (CRITICAL - now nested in summary)
        latitude = summary.get("latitude", 0.0)
        longitude = summary.get("longitude", 0.0)
        geolocation = Geolocation(latitude=latitude, longitude=longitude)

        # Optional: Extract name from summary if it differs from title
        extracted_name = summary.get("name", title)

        # Create result with defaults for missing fields
        result = RestaurantResult(
            name=extracted_name or title,
            url=url,
            geolocation=geolocation,
            address="Not available",  # ⚠️ Would need expanded schema
            cuisine="Not specified",  # ⚠️ Would need expanded schema
            rating=0.0,               # ⚠️ Would need expanded schema
            match_score=5.0,          # Default confidence
            match_criteria=[],        # Empty by default
            price_range="Unknown"     # ⚠️ Would need expanded schema
        )

        return result


async def test_fast_search_with_default_schema():
    """
    Test 1: Current schema (name, latitude, longitude only)
    This matches your test file but demonstrates the gaps.
    """
    if not EXA_API_KEY:
        print("❌ Error: EXA_API_KEY not found in backend/.env")
        return

    print("\n=== Starting Fast Search Test ===")

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
        "num_results": 10,
        "livecrawl": "never",
        "contents": {
            "summary": {
                "query": "Extract coffee shop name, latitude and longitude",
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
        
        print(json.dumps(data, indent=2))
                
    except Exception as e:
        print(f"\n❌ Error: {e}")


async def test_fast_search_with_expanded_schema():
    """
    Test 2: Expanded schema including rating, cuisine, address, price_range
    This is the RECOMMENDED approach to get all fields from Exa extraction.
    """
    if not EXA_API_KEY:
        print("❌ Error: EXA_API_KEY not found in backend/.env")
        return

    print("\n" + "="*70)
    print("TEST 2: Fast Search with EXPANDED Schema (all fields)")
    print("="*70)

    query = "best coffee shops near Avenue des Champs-Élysées Paris"
    
    # EXPANDED schema with all fields you need
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
            },
            "address": {
                "type": "string",
                "description": "Full street address"
            },
            "cuisine": {
                "type": "string",
                "description": "Type of cuisine (e.g., French, Italian, Café)"
            },
            "rating": {
                "type": "number",
                "description": "Rating out of 5.0"
            },
            "price_range": {
                "type": "string",
                "description": "Price range indicator ($, $$, $$$, $$$$)"
            },
            "highlights": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Notable features (outdoor seating, wifi, etc.)"
            }
        },
        "required": ["name", "latitude", "longitude"]
    }
    
    payload = {
        "query": query,
        "type": "fast",
        "num_results": 3,
        "livecrawl": "never",
        "contents": {
            "summary": {
                "query": "Extract restaurant name, full address, cuisine type, rating, price range, and notable features",
                "schema": schema
            }
        }
    }
    
    print(f"\nQuery: {query}")
    print(f"\nExpanded Schema Properties:")
    for prop in schema["properties"].keys():
        print(f"  ✓ {prop}")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                EXA_API_URL,
                json=payload,
                headers={"x-api-key": EXA_API_KEY}
            )
            response.raise_for_status()
            data = response.json()
        
        print(f"\n✅ Response Status: {response.status_code}")
        print(f"Request ID: {data.get('requestId')}")
        print(f"Total Results: {len(data.get('results', []))}")
        
        print("\n--- RAW API RESPONSE (with expanded fields) ---")
        for i, result in enumerate(data.get("results", []), 1):
            print(f"\nResult {i}:")
            print(json.dumps(result, indent=2))
        
        print("\n--- TRANSFORMATION ANALYSIS ---")
        transformer = ExaFastSearchTransformer()
        for i, raw_result in enumerate(data.get("results", []), 1):
            summary = transformer.parse_summary(raw_result.get("summary", "{}"))
            print(f"\nResult {i} - Extracted Summary Fields:")
            print(json.dumps(summary, indent=2))
                
    except Exception as e:
        print(f"\n❌ Error: {e}")


async def test_response_transformation_logic():
    """
    Test 3: Verify transformation logic with mock data
    Tests the transformer without hitting the API (useful for CI/CD)
    """
    print("\n" + "="*70)
    print("TEST 3: Transformation Logic (Mock Data)")
    print("="*70)

    # Mock Exa Fast Search response
    mock_response = {
        "requestId": "test-123",
        "results": [
            {
                "title": "Café de Flore",
                "url": "https://example.com/cafe-de-flore",
                "summary": json.dumps({
                    "name": "Café de Flore",
                    "latitude": 48.8537,
                    "longitude": 2.3338,
                    "address": "172 Boulevard Saint-Germain",
                    "cuisine": "French",
                    "rating": 4.5,
                    "price_range": "$$"
                })
            },
            {
                "title": "Les Deux Magots",
                "url": "https://example.com/deux-magots",
                "summary": json.dumps({
                    "name": "Les Deux Magots",
                    "latitude": 48.8541,
                    "longitude": 2.3323,
                    "address": "6 Place Saint-Germain-des-Prés",
                    "cuisine": "French",
                    "rating": 4.3,
                    "price_range": "$$$"
                })
            },
            {
                "title": "Unknown Café",
                "url": "https://example.com/unknown",
                "summary": "{}"  # Edge case: empty summary
            }
        ]
    }

    print(f"\nMock API Response (simulating Exa Fast Search):")
    print(json.dumps(mock_response, indent=2))

    print("\n--- TRANSFORMATION RESULTS ---")
    transformer = ExaFastSearchTransformer()
    
    for i, raw_result in enumerate(mock_response["results"], 1):
        transformed = transformer.transform_result(raw_result)
        print(f"\nResult {i}:")
        print(json.dumps(transformed.to_dict(), indent=2))


async def main():
    """Run all tests"""
    await test_fast_search_with_default_schema()


if __name__ == "__main__":
    asyncio.run(main())

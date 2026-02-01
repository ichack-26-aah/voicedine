import json
import os
from typing import Any

import httpx

LOCATION = "Champs-Élysées, Paris, France"
PARIS_LAT = 48.8566
PARIS_LON = 2.3522
GEO_TOLERANCE = 2.0  # +-2 degrees
EXA_API_URL = "https://api.exa.ai/search"

# Simple flat schema for fast search - matches test_fast_search.py
FAST_SEARCH_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "Restaurant/cafe name"
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


def is_valid_location(lat: float, lon: float) -> bool:
    """Check if coordinates are within +-2 degrees of Paris and not 0,0"""
    return (
        abs(lat - PARIS_LAT) <= GEO_TOLERANCE
        and abs(lon - PARIS_LON) <= GEO_TOLERANCE
        and lat != 0.0
        and lon != 0.0
    )


class ExaService:
    def __init__(self) -> None:
        self.api_key = os.getenv("EXA_API_KEY")
        if not self.api_key:
            raise ValueError("EXA_API_KEY environment variable is not set")

    async def fast_search(
        self,
        user_prompt: str,
        num_results: int = 10,
    ) -> list[dict[str, Any]]:
        """Fast search using Exa Search API - returns results quickly with basic info."""
        query = f"restaurants cafes {user_prompt} near {LOCATION}"
        print(f"[Exa] Searching for: {query}")

        payload = {
            "query": query,
            "type": "fast",
            "num_results": num_results,
            "livecrawl": "never",
            "contents": {
                "summary": {
                    "query": "Extract restaurant/cafe name, latitude and longitude",
                    "schema": FAST_SEARCH_SCHEMA,
                }
            },
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    EXA_API_URL,
                    json=payload,
                    headers={"x-api-key": self.api_key},
                )
                response.raise_for_status()
                data = response.json()
                print(f"[Exa] Raw API response: {len(data.get('results', []))} results")
                if len(data.get('results', [])) == 0:
                    print(f"[Exa] Full response: {data}")
        except httpx.TimeoutException as e:
            raise TimeoutError(f"Exa fast search timed out: {e}") from e
        except httpx.HTTPStatusError as e:
            print(f"[Exa] HTTP Error {e.response.status_code}: {e.response.text}")
            raise RuntimeError(f"Exa fast search HTTP error: {e.response.status_code}") from e
        except Exception as e:
            print(f"[Exa] Exception: {e}")
            raise RuntimeError(f"Exa fast search failed: {e}") from e

        # Transform and filter results
        restaurants: list[dict[str, Any]] = []
        raw_results = data.get("results", [])
        print(f"[Exa] Processing {len(raw_results)} raw results")

        for i, result in enumerate(raw_results):
            print(f"[Exa] Result {i}: {result.get('title', 'Unknown')}")
            transformed = self._transform_result(result)
            if transformed:
                print(f"[Exa] ✓ Transformed result {i}: {transformed.get('name')}")
                restaurants.append(transformed)
            else:
                print(f"[Exa] ✗ Filtered out result {i} (invalid geolocation)")

        print(f"[Exa] Returning {len(restaurants)} valid restaurants")
        return restaurants

    def _transform_result(self, raw_result: dict[str, Any]) -> dict[str, Any] | None:
        """Transform raw Exa result to RestaurantResult format."""
        try:
            summary_text = raw_result.get("summary", "{}")
            summary = json.loads(summary_text)
            print(f"[Exa] Parsed summary: {summary}")
        except json.JSONDecodeError as e:
            print(f"[Exa] JSON decode error: {e}, raw: {raw_result.get('summary', '')[:100]}")
            return None

        # Get lat/lng from flat schema (matches test_fast_search.py)
        lat = summary.get("latitude", 0.0)
        lon = summary.get("longitude", 0.0)

        print(f"[Exa] Coords: lat={lat}, lon={lon}")

        # Filter out invalid geolocations
        if not is_valid_location(lat, lon):
            print(f"[Exa] Invalid location: lat={lat}, lon={lon}")
            return None

        title = raw_result.get("title", "")
        name = summary.get("name") or title or "Unknown"
        url = raw_result.get("url", "")

        return {
            "name": name,
            "address": "Not available",
            "cuisine": "Not specified",
            "rating": 0.0,
            "match_score": 10.0,
            "match_criteria": [],
            "price_range": "Unknown",
            "url": url,
            "geolocation": {
                "latitude": lat,
                "longitude": lon,
            },
        }

    async def get_dishes(
        self,
        restaurant_url: str,
        restaurant_name: str,
        cuisine: str = "",
    ) -> list[dict[str, Any]]:
        """
        Fetch top menu dishes from a restaurant URL using Exa get_contents.
        """
        print(f"[Exa] Fetching dishes for: {restaurant_name} ({restaurant_url})")

        requirements = f"popular dishes at {restaurant_name}"
        if cuisine:
            requirements += f", {cuisine} cuisine"

        dish_schema: dict[str, Any] = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
                "dish_name": {"type": "string", "description": "Name of dish"},
                "price": {"type": "string", "description": "Price"},
                "description": {"type": "string", "description": "Brief description"}
            },
            "required": ["dish_name"]
        }

        payload = {
            "ids": [restaurant_url],
            "text": True,
            "summary": {
                "query": f"Find menu items at {restaurant_name}. Extract dish name, price, description.",
                "schema": dish_schema
            }
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    "https://api.exa.ai/contents",
                    json=payload,
                    headers={"x-api-key": self.api_key},
                )
                print(f"[Exa] Dishes response status: {response.status_code}")
                if response.status_code != 200:
                    print(f"[Exa] Dishes error: {response.text}")
                    return []
                data = response.json()
        except httpx.TimeoutException as e:
            print(f"[Exa] Dishes timeout: {e}")
            return []  # Return empty instead of raising
        except Exception as e:
            print(f"[Exa] Dishes exception: {e}")
            return []  # Return empty instead of raising

        results = data.get("results", [])
        if not results:
            print("[Exa] No dish results")
            return []

        summary = results[0].get("summary", "{}")
        print(f"[Exa] Dish summary: {summary[:200] if summary else 'empty'}...")

        if isinstance(summary, str):
            try:
                dishes_data = json.loads(summary)
            except json.JSONDecodeError:
                print("[Exa] Failed to parse dish summary JSON")
                return []
        else:
            dishes_data = summary

        # Handle both single dish and array format
        dishes = []
        if "dish_name" in dishes_data:
            # Single dish response
            dishes.append({
                "name": dishes_data.get("dish_name", "Unknown Dish"),
                "price": dishes_data.get("price", ""),
                "imageUrl": None,
                "description": dishes_data.get("description")
            })
        elif "dishes" in dishes_data:
            # Array response
            for dish in dishes_data.get("dishes", []):
                dishes.append({
                    "name": dish.get("name") or dish.get("dish_name", "Unknown Dish"),
                    "price": dish.get("price", ""),
                    "imageUrl": dish.get("image_url"),
                    "description": dish.get("description")
                })

        print(f"[Exa] Returning {len(dishes)} dishes")
        return dishes


def get_exa_service() -> ExaService:
    """Factory function used as a FastAPI dependency."""
    return ExaService()

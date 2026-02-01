import json
import os
from typing import Any

import httpx

LOCATION = "Champs-Élysées, Paris, France"
PARIS_LAT = 48.8566
PARIS_LON = 2.3522
GEO_TOLERANCE = 2.0  # +-2 degrees

SYSTEM_PROMPT = "Search for restaurants in " + LOCATION + " based on the user specified constraints. Return the restaurant's phone number if available."

# Fast search schema - only extracts name and coordinates
FAST_SEARCH_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "restaurants": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "address": {"type": "string"},
                    "cuisine": {"type": "string"},
                    "rating": {"type": "number"},
                    "match_score": {"type": "number"},
                    "match_criteria": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "price_range": {"type": "string"},
                    "url": {"type": "string"},
                    "phone": {"type": "string"},
                    "geolocation": {
                        "type": "object",
                        "properties": {
                            "latitude": {"type": "number"},
                            "longitude": {"type": "number"},
                        },
                        "required": ["latitude", "longitude"],
                    },
                },
                "required": [
                    "name",
                    "address",
                    "cuisine",
                    "rating",
                    "match_score",
                    "match_criteria",
                    "price_range",
                    "url",
                    "geolocation",
                    # "phone" is optional depending on Exa's finding, so we don't strictly require it
                ],
            },
        },
    },
    "required": ["name", "latitude", "longitude"],
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
        query = f"{user_prompt} near {LOCATION}"

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
        except httpx.TimeoutException as e:
            raise TimeoutError(f"Exa fast search timed out: {e}") from e
        except Exception as e:
            raise RuntimeError(f"Exa fast search failed: {e}") from e

        # Transform and filter results
        restaurants: list[dict[str, Any]] = []
        for result in data.get("results", []):
            transformed = self._transform_result(result)
            if transformed:
                restaurants.append(transformed)

        return restaurants

    def _transform_result(self, raw_result: dict[str, Any]) -> dict[str, Any] | None:
        """Transform raw Exa result to RestaurantResult format."""
        try:
            summary_text = raw_result.get("summary", "{}")
            summary = json.loads(summary_text)
        except json.JSONDecodeError:
            return None

        lat = summary.get("latitude", 0.0)
        lon = summary.get("longitude", 0.0)

        # Filter out invalid geolocations
        if not is_valid_location(lat, lon):
            return None

        title = raw_result.get("title", "")
        name = summary.get("name") or title or "Unknown"
        url = raw_result.get("url", "")

        return {
            "name": name,
            "address": "Not available",
            "cuisine": "Not specified",
            "rating": 0.0,
            "match_score": 5.0,
            "match_criteria": [],
            "price_range": "Unknown",
            "url": url,
            "geolocation": {
                "latitude": lat,
                "longitude": lon,
            },
        }


def get_exa_service() -> ExaService:
    """Factory function used as a FastAPI dependency."""
    return ExaService()

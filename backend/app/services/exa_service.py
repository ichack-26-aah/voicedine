import os
from typing import Any

from exa_py import Exa

LOCATION="Champs-Élysées, Paris, France"

SYSTEM_PROMPT = "Search for restaurants in " + LOCATION + " based on the user specified constraints."

RESTAURANT_OUTPUT_SCHEMA: dict[str, Any] = {
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
                ],
            },
        },
    },
    "required": ["restaurants"],
}


class ExaService:
    def __init__(self) -> None:
        api_key = os.getenv("EXA_API_KEY")
        if not api_key:
            raise ValueError("EXA_API_KEY environment variable is not set")
        self.client = Exa(api_key=api_key)

    def create_research(
        self,
        user_prompt: str,
        model: str = "exa-research",
    ) -> dict[str, Any]:
        """Start an Exa research task and return its ID."""
        instructions = f"{SYSTEM_PROMPT}\n\n{user_prompt}"

        try:
            task = self.client.research.create_task(
                instructions=instructions,
                model=model,
                output_schema=RESTAURANT_OUTPUT_SCHEMA,
            )
            return {"research_id": task.id}
        except Exception as e:
            raise RuntimeError(f"Exa research creation failed: {e}") from e

    def get_research(
        self,
        research_id: str,
    ) -> dict[str, Any]:
        """Fetch an Exa research task by ID and return its current state."""
        try:
            task = self.client.research.get_task(research_id)

            result: dict[str, Any] = {
                "research_id": task.id,
                "status": task.status,
            }

            if task.data is not None:
                result["data"] = task.data

            return result
        except Exception as e:
            raise RuntimeError(f"Exa research retrieval failed: {e}") from e

    def research_sync(
        self,
        user_prompt: str,
        model: str = "exa-research",
    ) -> list[dict[str, Any]]:
        """Create a research task, poll until done, and return restaurants list."""
        task_info = self.create_research(user_prompt, model=model)
        research_id: str = task_info["research_id"]

        try:
            task = self.client.research.poll_task(research_id)
        except TimeoutError:
            raise
        except Exception as e:
            raise RuntimeError(f"Exa research polling failed: {e}") from e

        data = task.data or {}
        return data.get("restaurants", [])


def get_exa_service() -> ExaService:
    """Factory function used as a FastAPI dependency."""
    return ExaService()

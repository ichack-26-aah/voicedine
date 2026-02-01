import os
import time
from typing import Any

from exa_py import Exa

SYSTEM_PROMPT = "Search for restaurants in the specified location based on the user specified constraints."

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
        model: str = "exa-research-fast",
    ) -> dict[str, Any]:
        """Start an Exa research task and return its ID."""
        instructions = f"{SYSTEM_PROMPT}\n\n{user_prompt}"

        try:
            task = self.client.research.create(
                instructions=instructions,
                model=model,
                output_schema=RESTAURANT_OUTPUT_SCHEMA,
            )
            return {
                "research_id": task.research_id,
                "created_at": getattr(task, "created_at", None),
            }
        except Exception as e:
            raise RuntimeError(f"Exa research creation failed: {e}") from e

    def get_research(
        self,
        research_id: str,
        events: bool = False,
    ) -> dict[str, Any]:
        """Poll an Exa research task by ID and return its current state."""
        try:
            task = self.client.research.get(
                research_id,
                events=events,
            )

            result: dict[str, Any] = {
                "research_id": research_id,
                "status": task.status,
            }

            if task.status == "completed" and task.output is not None:
                result["output"] = {
                    "content": task.output.content,
                    "parsed": task.output.parsed,
                }
                result["cost_dollars"] = getattr(task, "cost_dollars", None)

            if events:
                result["events"] = getattr(task, "events", None)

            return result
        except Exception as e:
            raise RuntimeError(f"Exa research retrieval failed: {e}") from e

    def research_sync(
        self,
        user_prompt: str,
        model: str = "exa-research-fast",
        poll_interval: float = 2.0,
        timeout: float = 120.0,
    ) -> dict[str, Any]:
        """Create a research task, poll until done, and return parsed output."""
        task_data = self.create_research(user_prompt, model=model)
        research_id: str = task_data["research_id"]

        elapsed = 0.0
        while elapsed < timeout:
            result = self.get_research(research_id)
            if result["status"] == "completed":
                return result
            time.sleep(poll_interval)
            elapsed += poll_interval

        raise TimeoutError(
            f"Research {research_id} did not complete within {timeout}s"
        )


def get_exa_service() -> ExaService:
    """Factory function used as a FastAPI dependency."""
    return ExaService()

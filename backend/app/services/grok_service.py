"""Grok (xAI) service for extracting structured requirements from voice transcripts."""

import json
import os
from typing import Any

import httpx

XAI_API_URL = "https://api.x.ai/v1/chat/completions"

SYSTEM_PROMPT = """You are an AI assistant for VoiceDine, a voice-powered restaurant discovery app. 
Your job is to extract clear, structured food and restaurant requirements from casual multi-user conversations.

Users speak naturally about what they're looking for in a restaurant or food spot. You must:
1. Extract specific requirements mentioned (cuisine type, price range, ambiance, dietary restrictions, etc.)
2. Tag each requirement with the speaker who mentioned it (User 0, User 1, etc.)
3. Return a JSON array of requirement strings

Examples of requirements to extract:
- Cuisine types: "Italian food", "Sushi", "Mexican", "French bistro"
- Price preferences: "Budget friendly", "Upscale", "Mid-range"
- Dietary needs: "Vegetarian", "Vegan options", "Gluten-free"
- Ambiance: "Romantic", "Family-friendly", "Outdoor seating"
- Features: "Good for groups", "Live music", "Late night"
- Specific dishes: "Good pasta", "Best pizza", "Fresh seafood"

IMPORTANT: Only extract actual requirements. Ignore filler words, greetings, or off-topic conversation.
If no clear requirements are found in the text, return an empty array.

Return ONLY a valid JSON array of strings, nothing else. Each string should be formatted as:
"Requirement [User X]"

Example output:
["Italian food [User 0]", "Budget friendly [User 1]", "Outdoor seating [User 0]"]
"""


class GrokService:
    """Service for processing transcripts with Grok (xAI) to extract requirements."""

    def __init__(self) -> None:
        self.api_key = os.getenv("XAI_API_KEY")
        if not self.api_key:
            raise ValueError("XAI_API_KEY environment variable is not set")

    async def extract_requirements(
        self,
        transcript: str,
        speaker_labels: dict[int, str] | None = None,
    ) -> list[str]:
        """
        Extract structured requirements from an unstructured voice transcript.
        
        Args:
            transcript: The raw transcript text from voice input
            speaker_labels: Optional mapping of speaker IDs to labels (e.g., {0: "User 0"})
            
        Returns:
            List of requirement strings tagged with speakers, e.g.:
            ["American Food [User 1]", "Pasta [User 2]"]
        """
        if not transcript or not transcript.strip():
            return []

        # Build the user message with speaker context if available
        user_message = f"Extract food and restaurant requirements from this conversation:\n\n{transcript}"
        
        if speaker_labels:
            labels_str = ", ".join([f"Speaker {k} = {v}" for k, v in speaker_labels.items()])
            user_message = f"Speaker labels: {labels_str}\n\n{user_message}"

        payload = {
            "model": "grok-3-fast",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.3,  # Lower temperature for more consistent extraction
            "max_tokens": 500,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    XAI_API_URL,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                )
                response.raise_for_status()
                data = response.json()
        except httpx.TimeoutException as e:
            raise TimeoutError(f"Grok API request timed out: {e}") from e
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Grok API error: {e.response.status_code} - {e.response.text}") from e
        except Exception as e:
            raise RuntimeError(f"Grok API request failed: {e}") from e

        # Parse the response
        try:
            content = data["choices"][0]["message"]["content"]
            # Clean up the response - remove markdown code blocks if present
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            requirements = json.loads(content)
            
            if not isinstance(requirements, list):
                return []
            
            # Ensure all items are strings
            return [str(req) for req in requirements if req]
            
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            print(f"Failed to parse Grok response: {e}, content: {data}")
            return []

    async def extract_requirements_with_context(
        self,
        new_transcript: str,
        existing_requirements: list[str],
    ) -> list[str]:
        """
        Extract requirements while being aware of existing requirements.
        This helps avoid duplicates and understand context.
        
        Args:
            new_transcript: New transcript text to process
            existing_requirements: Previously extracted requirements
            
        Returns:
            List of NEW requirements only (not duplicates of existing)
        """
        if not new_transcript or not new_transcript.strip():
            return []

        context = ""
        if existing_requirements:
            context = f"\n\nAlready captured requirements (don't repeat these unless they add new detail):\n{json.dumps(existing_requirements)}"

        user_message = f"Extract NEW food and restaurant requirements from this conversation:{context}\n\nNew conversation:\n{new_transcript}"

        payload = {
            "model": "grok-3-fast",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.3,
            "max_tokens": 500,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    XAI_API_URL,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                )
                response.raise_for_status()
                data = response.json()
        except Exception as e:
            raise RuntimeError(f"Grok API request failed: {e}") from e

        try:
            content = data["choices"][0]["message"]["content"]
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            requirements = json.loads(content)
            
            if not isinstance(requirements, list):
                return []
            
            return [str(req) for req in requirements if req]
            
        except (json.JSONDecodeError, KeyError, IndexError):
            return []

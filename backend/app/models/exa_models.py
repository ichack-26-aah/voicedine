from typing import Any

from pydantic import BaseModel, Field


# --- Request models ---

class ResearchCreateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="User search query / constraints")
    model: str = Field(
        "exa-research",
        description="Research model: exa-research or exa-research-pro",
    )


# --- Restaurant schema (mirrors the output_schema sent to Exa) ---

class RestaurantResult(BaseModel):
    name: str
    address: str
    cuisine: str
    rating: float = Field(..., ge=0.0, le=5.0)
    match_score: float = Field(..., ge=0.0, le=10.0)
    match_criteria: list[str]
    price_range: str
    url: str


# --- Response models ---

class ResearchCreateResponse(BaseModel):
    research_id: str


class ResearchGetResponse(BaseModel):
    research_id: str
    status: str
    data: dict[str, Any] | None = None


class ResearchSyncRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="User search query / constraints")
    model: str = Field(
        "exa-research",
        description="Research model: exa-research or exa-research-pro",
    )

from typing import Any

from pydantic import BaseModel, Field


# --- Request models ---

class ResearchCreateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="User search query / constraints")
    model: str = Field(
        "exa-research-fast",
        description="Research model: exa-research-fast, exa-research, or exa-research-pro",
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
    created_at: str | None = None


class ResearchOutput(BaseModel):
    content: str | None = None
    parsed: dict[str, Any] | None = None


class ResearchGetResponse(BaseModel):
    research_id: str
    status: str
    output: ResearchOutput | None = None
    cost_dollars: Any | None = None
    events: list[Any] | None = None


class ResearchSyncRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="User search query / constraints")

class RestaurantLocation(BaseModel):
    name: str
    lat: float
    lng: float

class RestaurantSearchResponse(BaseModel):
    restaurants: list[RestaurantLocation]
    request_id: str
    model: str = Field(
        "exa-research-fast",
        description="Research model: exa-research-fast, exa-research, or exa-research-pro",
    )

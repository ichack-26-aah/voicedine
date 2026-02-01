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

class Geolocation(BaseModel):
    latitude: float
    longitude: float


class RestaurantResult(BaseModel):
    name: str
    address: str = "Not available"
    cuisine: str = "Not specified"
    rating: float = 0.0
    match_score: float = 5.0
    match_criteria: list[str] = []
    price_range: str = "Unknown"
    url: str
    geolocation: Geolocation


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


# --- Dish menu item ---

class DishItem(BaseModel):
    name: str
    price: str = ""
    imageUrl: str | None = None
    description: str | None = None


class DishRequest(BaseModel):
    restaurantUrl: str = Field(..., description="URL of the restaurant")
    restaurantName: str = Field(..., description="Name of the restaurant")
    cuisine: str = Field("", description="Cuisine type for context")

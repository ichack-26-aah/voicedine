import json
import httpx
import os
from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.exa_models import (
    ResearchCreateRequest,
    ResearchCreateResponse,
    ResearchGetResponse,
    ResearchSyncRequest,
    RestaurantResult,
    RestaurantSearchResponse,
    RestaurantLocation,
)
from app.services.exa_service import ExaService, get_exa_service

router = APIRouter(prefix="/api/exa", tags=["exa"])


@router.get("/restaurants", response_model=RestaurantSearchResponse)
async def search_restaurants(query: str = "vegan Italian restaurants near Oxford Street London"):
    """
    Ultra-fast restaurant search with geolocation.
    Hits Exa Fast search + minimal post-processing.
    Expected latency: ~500-700ms end-to-end
    """
    exa_api_key = os.getenv("EXA_API_KEY")
    if not exa_api_key:
        raise HTTPException(status_code=500, detail="EXA_API_KEY not found")
        
    exa_api_url = "https://api.exa.ai/search"
    
    # Structured JSON schema for extraction (minimal fields = fastest)
    schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Restaurant name"
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
        "type": "fast",  # <-- CRITICAL: Use 'fast' for <500ms latency
        "num_results": 10,
        "livecrawl": "never",  # Skip live crawl = faster
        "contents": {
            "summary": {
                "query": "Extract restaurant name, latitude and longitude",
                "schema": schema
            }
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                exa_api_url,
                json=payload,
                headers={"x-api-key": exa_api_key}
            )
            response.raise_for_status()
            data = response.json()
        
        # Extract name + geo from structured summaries
        restaurants = []
        for result in data.get("results", []):
            try:
                # Parse the JSON summary returned by Exa
                summary_text = result.get("summary", "{}")
                # Sometimes the summary might be backticked or have extra text if not forced strictly
                # But Exa summary with schema usually returns valid JSON
                summary_json = json.loads(summary_text)
                restaurants.append(RestaurantLocation(
                    name=summary_json.get("name", result.get("title", "Unknown")),
                    lat=summary_json.get("latitude", 51.515),  # Oxford St default
                    lng=summary_json.get("longitude", -0.142)
                ))
            except (json.JSONDecodeError, ValueError):
                # Fallback if summary parsing fails
                continue
        
        return RestaurantSearchResponse(
            restaurants=restaurants[:10],
            request_id=data.get("requestId", "")
        )
    
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Exa API error: {str(e)}")


@router.post("/research", response_model=ResearchCreateResponse)
async def create_research(
    request: ResearchCreateRequest,
    exa: ExaService = Depends(get_exa_service),
) -> ResearchCreateResponse:
    try:
        data = exa.create_research(
            user_prompt=request.prompt,
            model=request.model,
        )
        return ResearchCreateResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}") from e


@router.post("/research/sync", response_model=list[RestaurantResult])
async def research_sync(
    request: ResearchSyncRequest,
    exa: ExaService = Depends(get_exa_service),
) -> list[RestaurantResult]:
    try:
        restaurants = exa.research_sync(
            user_prompt=request.prompt,
            model=request.model,
        )
        return [RestaurantResult(**r) for r in restaurants]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}") from e


@router.get("/research/{research_id}", response_model=ResearchGetResponse)
async def get_research(
    research_id: str,
    exa: ExaService = Depends(get_exa_service),
) -> ResearchGetResponse:
    try:
        data = exa.get_research(
            research_id=research_id,
        )
        return ResearchGetResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}") from e

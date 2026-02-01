import json
import httpx
import os
import asyncio
import aiohttp
import random
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator, Optional
from urllib.parse import urlparse
from exa_py import Exa

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


# =============================================================================
# FAST STREAMING SEARCH (NEW - Use this!)
# =============================================================================

def get_favicon_url(url: str) -> str:
    """Generate favicon URL from DuckDuckGo API - instant, no auth needed"""
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "")
    return f"https://icons.duckduckgo.com/ip3/{domain}.ico"


async def geocode_address(address: str, session: aiohttp.ClientSession) -> Optional[tuple]:
    """Geocode an address using Nominatim (OpenStreetMap) - free, no API key"""
    if not address:
        print(f"[Geocoding] Empty address, skipping")
        return None
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": address[:200], "format": "json", "limit": 1}
        headers = {"User-Agent": "VoiceDine/1.0"}
        print(f"[Geocoding] Trying: {address[:50]}...")
        async with session.get(url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=3)) as response:
            if response.status == 200:
                data = await response.json()
                if data:
                    lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
                    print(f"[Geocoding] SUCCESS: {address[:30]} -> ({lat:.4f}, {lng:.4f})")
                    return (lat, lng)
                else:
                    print(f"[Geocoding] No results for: {address[:50]}")
            else:
                print(f"[Geocoding] HTTP {response.status} for: {address[:50]}")
    except Exception as e:
        print(f"[Geocoding] Error for {address[:30]}: {type(e).__name__}: {e}")
    return None


def extract_location_from_text(text: str, title: str) -> Optional[str]:
    """Try to extract a location/address from the text content"""
    import re
    
    # Common patterns for addresses
    patterns = [
        # US addresses
        r'\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)[\w\s,]*(?:NY|CA|TX|FL|IL|PA|OH|GA|NC|MI)',
        # City, State pattern
        r'(?:located in|located at|in)\s+([\w\s]+,\s*[A-Z]{2})',
        # UK postcodes
        r'[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2}',
        # "in City" pattern
        r'(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
    ]
    
    combined_text = f"{title} {text}"
    
    for pattern in patterns:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            return match.group(0)
    
    return None


async def process_single_result(
    result,
    index: int,
    session: aiohttp.ClientSession,
    base_lat: float,
    base_lng: float,
    search_location: str
) -> dict:
    """Process a single Exa result and geocode it - runs in parallel"""
    text = getattr(result, 'text', '') or ''
    title = result.title or "Unknown Restaurant"
    url = result.url or ""
    
    print(f"[Process] #{index}: {title[:50]}")
    
    # Strategy 1: Try to extract location from text content
    extracted_location = extract_location_from_text(text, title)
    coords = None
    
    if extracted_location:
        print(f"[Process] #{index} - Found location in text: {extracted_location}")
        coords = await geocode_address(extracted_location, session)
    
    # Strategy 2: Try title + search location
    if not coords and search_location:
        query = f"{title.split(' - ')[0].split('|')[0].strip()} {search_location}"
        coords = await geocode_address(query, session)
    
    # Strategy 3: Just the title (restaurant name)
    if not coords:
        coords = await geocode_address(title.split(' - ')[0].split('|')[0].strip(), session)
    
    if coords:
        lat, lng = coords
        print(f"[Process] #{index} - GEOCODED: ({lat:.4f}, {lng:.4f})")
    else:
        # Fallback: random spread around base location (more realistic than diagonal)
        lat = base_lat + random.uniform(-0.02, 0.02)
        lng = base_lng + random.uniform(-0.02, 0.02)
        print(f"[Process] #{index} - FALLBACK random: ({lat:.4f}, {lng:.4f})")
    
    return {
        "name": title.split(' - ')[0].split('|')[0].strip()[:100],  # Clean up title
        "address": text[:200] if text else "",
        "cuisine": "Restaurant",
        "rating": round(4.0 + random.uniform(-0.5, 0.5), 1),
        "match_score": round(9.5 - (index * 0.3), 1),
        "match_criteria": ["Fast search result"],
        "price_range": "$$",
        "url": url,
        "geolocation": {
            "latitude": lat,
            "longitude": lng
        }
    }


async def stream_fast_search(prompt: str, num_results: int = 10):
    """
    Stream search results using Exa's search API with schema extraction.
    Same approach as /restaurants endpoint but streaming.
    """
    # Hardcoded location - Champs-Élysées, Paris (matches frontend map center)
    HARDCODED_LOCATION = "Champs-Élysées, Paris, France"
    HARDCODED_LAT = 48.8698
    HARDCODED_LNG = 2.3078
    
    # Append location to user's prompt for location-specific results
    location_prompt = f"{prompt} near {HARDCODED_LOCATION}"
    print(f"[SSE] Starting search for: {location_prompt}")
    
    exa_api_key = os.getenv("EXA_API_KEY")
    if not exa_api_key:
        yield f"event: error\ndata: {json.dumps({'message': 'EXA_API_KEY not found'})}\n\n"
        return
    
    # Same schema as /restaurants endpoint - gets structured data from Exa
    schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "Restaurant name"},
            "address": {"type": "string", "description": "Full address"},
            "cuisine": {"type": "string", "description": "Type of cuisine"},
            "latitude": {"type": "number", "description": "Latitude coordinate"},
            "longitude": {"type": "number", "description": "Longitude coordinate"},
            "price_range": {"type": "string", "description": "Price range ($, $$, $$$, $$$$)"},
            "rating": {"type": "number", "description": "Rating out of 5"}
        },
        "required": ["name", "latitude", "longitude"]
    }
    
    payload = {
        "query": location_prompt,
        "type": "auto",
        "num_results": num_results,
        "contents": {
            "summary": {
                "query": f"Extract restaurant details: name, full address, cuisine type, latitude, longitude, price range, and rating. Location must be near {HARDCODED_LOCATION}",
                "schema": schema
            }
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            print(f"[SSE] Calling Exa API with schema extraction...")
            response = await client.post(
                "https://api.exa.ai/search",
                json=payload,
                headers={"x-api-key": exa_api_key}
            )
            response.raise_for_status()
            data = response.json()
        
        results = data.get("results", [])
        print(f"[SSE] Exa returned {len(results)} results")
        
        if not results:
            yield f"event: done\ndata: 0\n\n"
            return
        
        # Stream each result
        sent_count = 0
        for i, result in enumerate(results):
            try:
                # Parse schema-extracted summary
                summary_text = result.get("summary", "{}")
                try:
                    s = json.loads(summary_text)
                    name = s.get("name", result.get("title", "Unknown"))
                    address = s.get("address", f"Near {HARDCODED_LOCATION}")
                    cuisine = s.get("cuisine", "Restaurant")
                    lat = s.get("latitude")
                    lng = s.get("longitude")
                    price_range = s.get("price_range", "$$")
                    rating = s.get("rating")
                except json.JSONDecodeError:
                    name = result.get("title", "Unknown Restaurant")
                    address = f"Near {HARDCODED_LOCATION}"
                    cuisine = "Restaurant"
                    lat = None
                    lng = None
                    price_range = "$$"
                    rating = None
                
                # Validate coordinates
                coords_valid = (
                    lat is not None and lng is not None and
                    isinstance(lat, (int, float)) and isinstance(lng, (int, float)) and
                    -90 <= lat <= 90 and -180 <= lng <= 180
                )
                
                if not coords_valid:
                    # Fallback: spread around hardcoded location
                    lat = HARDCODED_LAT + random.uniform(-0.008, 0.008)
                    lng = HARDCODED_LNG + random.uniform(-0.008, 0.008)
                    print(f"[SSE] #{i} {name}: Using fallback coords")
                else:
                    print(f"[SSE] #{i} {name}: Schema coords ({lat:.4f}, {lng:.4f})")
                
                restaurant = {
                    "name": name,
                    "address": address,
                    "cuisine": cuisine,
                    "rating": rating,
                    "match_score": round(9.5 - (i * 0.3), 1),
                    "price_range": price_range,
                    "url": result.get("url", ""),
                    "geolocation": {
                        "latitude": lat,
                        "longitude": lng
                    }
                }
                
                print(f"[SSE] Streaming: {name}")
                yield f"data: {json.dumps(restaurant)}\n\n"
                sent_count += 1
                
            except Exception as e:
                print(f"[SSE] Error processing result {i}: {e}")
                continue
        
        yield f"event: done\ndata: {sent_count}\n\n"
        print(f"[SSE] Stream complete, sent {sent_count} results")
        
    except asyncio.CancelledError:
        print("[SSE] Client disconnected")
        raise
    except httpx.HTTPStatusError as e:
        # HTTP error with response body
        error_body = ""
        try:
            error_body = e.response.text
        except:
            pass
        error_msg = f"Exa API error {e.response.status_code}: {error_body[:500]}"
        print(f"[SSE] HTTP Status Error: {error_msg}")
        yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"
    except httpx.HTTPError as e:
        # Other HTTP errors (connection, timeout, etc.)
        error_msg = f"HTTP error: {type(e).__name__}: {str(e)}"
        print(f"[SSE] HTTP Error: {error_msg}")
        yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"[SSE] Error: {error_msg}")
        import traceback
        traceback.print_exc()
        yield f"event: error\ndata: {json.dumps({'message': error_msg})}\n\n"


@router.post("/research/stream")
async def research_stream(request: ResearchSyncRequest):
    """
    SSE streaming endpoint - streams restaurants one-by-one as they arrive.
    
    Uses Exa's FAST search API (not research API) for 10x speed improvement:
    - First result: ~1-2 seconds
    - All results: ~3-4 seconds (vs 10+ seconds with research API)
    """
    return StreamingResponse(
        stream_fast_search(request.prompt, num_results=10),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )


# =============================================================================
# DEPRECATED: Research API endpoints (slow - 10+ seconds)
# These use Exa's research API which polls until complete.
# Use /research/stream above instead for 10x faster results.
# =============================================================================

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
        "type": "fast",
        "num_results": 10,
        "livecrawl": "never",
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
        
        restaurants = []
        for result in data.get("results", []):
            try:
                summary_text = result.get("summary", "{}")
                summary_json = json.loads(summary_text)
                restaurants.append(RestaurantLocation(
                    name=summary_json.get("name", result.get("title", "Unknown")),
                    lat=summary_json.get("latitude", 51.515),
                    lng=summary_json.get("longitude", -0.142)
                ))
            except (json.JSONDecodeError, ValueError):
                continue
        
        return RestaurantSearchResponse(
            restaurants=restaurants[:10],
            request_id=data.get("requestId", "")
        )
    
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Exa API error: {str(e)}")


# DEPRECATED: Use /research/stream instead - this is slow (10+ seconds)
@router.post("/research", response_model=ResearchCreateResponse)
async def create_research(
    request: ResearchCreateRequest,
    exa: ExaService = Depends(get_exa_service),
) -> ResearchCreateResponse:
    """
    [DEPRECATED] Create a research task - slow, use /research/stream instead.
    """
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


# DEPRECATED: Use /research/stream instead - this is slow (10+ seconds)
@router.post("/research/sync", response_model=list[RestaurantResult])
async def research_sync(
    request: ResearchSyncRequest,
    exa: ExaService = Depends(get_exa_service),
) -> list[RestaurantResult]:
    """
    [DEPRECATED] Synchronous research - slow (10+ seconds), use /research/stream instead.
    """
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


# DEPRECATED: Use /research/stream instead
@router.get("/research/{research_id}", response_model=ResearchGetResponse)
async def get_research(
    research_id: str,
    exa: ExaService = Depends(get_exa_service),
) -> ResearchGetResponse:
    """
    [DEPRECATED] Get research task status - use /research/stream instead.
    """
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

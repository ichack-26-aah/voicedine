from fastapi import APIRouter, Depends, HTTPException

from app.models.exa_models import (
    ResearchSyncRequest,
    RestaurantResult,
)
from app.services.exa_service import ExaService, get_exa_service

router = APIRouter(prefix="/api/exa", tags=["exa"])


@router.post("/research/sync", response_model=list[RestaurantResult])
async def research_sync(
    request: ResearchSyncRequest,
    exa: ExaService = Depends(get_exa_service),
) -> list[RestaurantResult]:
    try:
        restaurants = await exa.fast_search(user_prompt=request.prompt)
        return [RestaurantResult(**r) for r in restaurants]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}") from e

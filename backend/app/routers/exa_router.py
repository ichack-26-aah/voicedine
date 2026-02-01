from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.exa_models import (
    ResearchCreateRequest,
    ResearchCreateResponse,
    ResearchGetResponse,
    ResearchSyncRequest,
    RestaurantResult,
)
from app.services.exa_service import ExaService, get_exa_service

router = APIRouter(prefix="/api/exa", tags=["exa"])


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
    events: bool = Query(False, description="Include event log in response"),
    exa: ExaService = Depends(get_exa_service),
) -> ResearchGetResponse:
    try:
        data = exa.get_research(
            research_id=research_id,
            events=events,
        )
        return ResearchGetResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}") from e

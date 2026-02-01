from fastapi import APIRouter, Depends, HTTPException

from app.models.exa_models import (
    ResearchSyncRequest,
    RestaurantResult,
    DishItem,
    DishRequest,
)
from app.services.exa_service import ExaService, get_exa_service

router = APIRouter(prefix="/api/exa", tags=["exa"])


@router.post("/dishes", response_model=list[DishItem])
async def get_dishes(
    request: DishRequest,
    exa: ExaService = Depends(get_exa_service),
) -> list[DishItem]:
    """
    Fetch popular dishes for a restaurant using Exa get_contents API.
    """
    try:
        dishes = await exa.get_dishes(
            restaurant_url=request.restaurantUrl,
            restaurant_name=request.restaurantName,
            cuisine=request.cuisine,
        )
        return [DishItem(**d) for d in dishes]
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        print(f"[Dishes] Error fetching dishes: {e}")
        return []


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

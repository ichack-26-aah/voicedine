from fastapi import APIRouter, Depends, HTTPException

from app.models.exa_models import ExaSearchRequest, ExaSearchResponse
from app.services.exa_service import ExaService, get_exa_service

router = APIRouter(prefix="/api/exa", tags=["exa"])


@router.post("/search", response_model=ExaSearchResponse)
async def search(
    request: ExaSearchRequest,
    exa: ExaService = Depends(get_exa_service),
) -> ExaSearchResponse:
    try:
        data = exa.search_content(
            prompt=request.prompt,
            num_results=request.num_results,
            search_type=request.search_type,
            use_autoprompt=request.use_autoprompt,
            include_text=request.include_text,
            include_domains=request.include_domains,
            exclude_domains=request.exclude_domains,
            start_published_date=request.start_published_date,
            end_published_date=request.end_published_date,
        )
        return ExaSearchResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}") from e

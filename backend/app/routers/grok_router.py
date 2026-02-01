from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.grok_service import GrokService

router = APIRouter(prefix="/api/grok", tags=["grok"])


class GrokExtractRequest(BaseModel):
    transcript: str = Field(..., description="The transcript text to extract requirements from")
    existing_requirements: list[str] | None = Field(None, description="Already extracted requirements to avoid duplicates")


class GrokExtractResponse(BaseModel):
    requirements: list[str]
    success: bool
    error: str | None = None


@router.post("/extract", response_model=GrokExtractResponse)
async def extract_requirements(request: GrokExtractRequest) -> GrokExtractResponse:
    """
    Extract food/restaurant requirements from conversation transcript using Grok API.
    """
    try:
        service = GrokService()
    except ValueError as e:
        return GrokExtractResponse(
            requirements=[],
            success=False,
            error=str(e)
        )

    try:
        existing = request.existing_requirements or []

        if existing:
            # Use context-aware extraction to avoid duplicates
            requirements = await service.extract_requirements_with_context(
                new_transcript=request.transcript,
                existing_requirements=existing
            )
        else:
            # First extraction, no context needed
            requirements = await service.extract_requirements(
                transcript=request.transcript
            )

        return GrokExtractResponse(
            requirements=requirements,
            success=True
        )

    except TimeoutError as e:
        return GrokExtractResponse(
            requirements=[],
            success=False,
            error=str(e)
        )
    except RuntimeError as e:
        return GrokExtractResponse(
            requirements=[],
            success=False,
            error=str(e)
        )
    except Exception as e:
        return GrokExtractResponse(
            requirements=[],
            success=False,
            error=f"Unexpected error: {str(e)}"
        )

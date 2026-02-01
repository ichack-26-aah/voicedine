from pydantic import BaseModel, Field


class ExaSearchRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Search query")
    num_results: int = Field(10, ge=1, le=50, description="Number of results")
    search_type: str = Field("auto", description="Search type: auto, keyword, or neural")
    use_autoprompt: bool = Field(True, description="Let Exa optimise the query")
    include_text: bool = Field(True, description="Include page text in results")
    include_domains: list[str] | None = Field(None, description="Restrict to these domains")
    exclude_domains: list[str] | None = Field(None, description="Exclude these domains")
    start_published_date: str | None = Field(None, description="Filter: start date (YYYY-MM-DD)")
    end_published_date: str | None = Field(None, description="Filter: end date (YYYY-MM-DD)")


class ExaSearchResult(BaseModel):
    title: str | None = None
    url: str | None = None
    text: str | None = None
    published_date: str | None = None
    author: str | None = None
    score: float | None = None


class ExaSearchResponse(BaseModel):
    results: list[ExaSearchResult]
    autoprompt_string: str | None = None

import os
from typing import Any

from exa_py import Exa


class ExaService:
    def __init__(self) -> None:
        api_key = os.getenv("EXA_API_KEY")
        if not api_key:
            raise ValueError("EXA_API_KEY environment variable is not set")
        self.client = Exa(api_key=api_key)

    def search_content(
        self,
        prompt: str,
        *,
        num_results: int = 10,
        search_type: str = "auto",
        use_autoprompt: bool = True,
        include_text: bool = True,
        include_domains: list[str] | None = None,
        exclude_domains: list[str] | None = None,
        start_published_date: str | None = None,
        end_published_date: str | None = None,
    ) -> dict[str, Any]:
        """Search for content using Exa and return formatted results."""
        try:
            response = self.client.search_and_contents(
                prompt,
                num_results=num_results,
                type=search_type,
                use_autoprompt=use_autoprompt,
                text=include_text,
                include_domains=include_domains,
                exclude_domains=exclude_domains,
                start_published_date=start_published_date,
                end_published_date=end_published_date,
            )

            results = []
            for result in response.results:
                results.append({
                    "title": result.title,
                    "url": result.url,
                    "text": getattr(result, "text", None),
                    "published_date": getattr(result, "published_date", None),
                    "author": getattr(result, "author", None),
                    "score": getattr(result, "score", None),
                })

            return {
                "results": results,
                "autoprompt_string": getattr(
                    response, "autoprompt_string", None
                ),
            }

        except Exception as e:
            raise RuntimeError(f"Exa search failed: {e}") from e


def get_exa_service() -> ExaService:
    """Factory function used as a FastAPI dependency."""
    return ExaService()

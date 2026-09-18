import requests
from urllib.parse import quote


GDELT_API_URL = (
    "https://api.gdeltproject.org/api/v2/doc/doc"
)


class GDELTService:

    def __init__(self):

        print("=" * 60)
        print("Initializing GDELT News Search Service")
        print("=" * 60)

    def search(
        self,
        query: str,
        max_records: int = 10,
        timespan: str = "1y"
    ):

        if not query or not query.strip():

            raise ValueError(
                "GDELT search query cannot be empty."
            )

        params = {
            "query": query.strip(),
            "mode": "artlist",
            "format": "json",
            "maxrecords": max_records,
            "timespan": timespan,
            "sort": "datedesc",
        }

        try:

            response = requests.get(
                GDELT_API_URL,
                params=params,
                timeout=30,
            )

            response.raise_for_status()

        except requests.exceptions.HTTPError as error:

            status_code = (
                error.response.status_code
                if error.response is not None
                else "unknown"
            )

            raise RuntimeError(
                f"GDELT API HTTP error "
                f"{status_code}: {error}"
            ) from error

        except requests.exceptions.RequestException as error:

            raise RuntimeError(
                f"GDELT API request failed: "
                f"{error}"
            ) from error

        try:

            data = response.json()

        except ValueError as error:

            raise RuntimeError(
                "GDELT returned invalid JSON."
            ) from error

        return self._parse_results(data)

    def _parse_results(self, data):

        results = []

        articles = data.get(
            "articles",
            []
        )

        for article in articles:

            results.append({

                "title": article.get(
                    "title"
                ),

                "url": article.get(
                    "url"
                ),

                "domain": article.get(
                    "domain"
                ),

                "language": article.get(
                    "language"
                ),

                "seendate": article.get(
                    "seendate"
                ),

                "source_country": article.get(
                    "sourcecountry"
                ),

                "social_image": article.get(
                    "socialimage"
                ),

            })

        return results
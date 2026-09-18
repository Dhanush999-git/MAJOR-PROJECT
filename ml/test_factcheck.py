from services.factcheck_service import FactCheckService


print("=" * 70)
print("VeriFact Google Fact Check API Test")
print("=" * 70)


try:

    service = FactCheckService()

    query = "COVID vaccine microchips"

    print("\nSearching for:")
    print(query)

    results = service.search(
        query=query,
        page_size=10
    )

    print("\nResults found:")
    print(len(results))

    if not results:

        print("\nNo existing fact-checks were found.")

    else:

        for index, result in enumerate(
            results,
            start=1
        ):

            print("\n" + "-" * 70)

            print(f"Result #{index}")

            print("\nClaim:")
            print(result.get("claim"))

            print("\nPublisher:")
            print(result.get("publisher"))

            print("\nRating:")
            print(result.get("rating"))

            print("\nTitle:")
            print(result.get("title"))

            print("\nReview Date:")
            print(result.get("review_date"))

            print("\nURL:")
            print(result.get("url"))


except Exception as error:

    print("\nFact-check API error:")
    print(error)


print("\n" + "=" * 70)
print("Fact Check API test completed.")
print("=" * 70)
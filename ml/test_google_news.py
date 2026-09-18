from services.google_news_service import GoogleNewsService


print("=" * 70)
print("VeriFact Google News RSS Test")
print("=" * 70)


try:

    service = GoogleNewsService()

    query = (
        "Earth revolves around the Sun"
    )

    print("\nSearch query:")
    print(query)

    results = service.search(
        query=query,
        max_results=5
    )

    print("\nResults found:")
    print(len(results))

    for index, result in enumerate(
        results,
        start=1
    ):

        print("\n" + "-" * 70)

        print(
            f"Result #{index}"
        )

        print("\nTitle:")
        print(
            result.get("title")
        )

        print("\nURL:")
        print(
            result.get("url")
        )

        print("\nPublished:")
        print(
            result.get("published")
        )

        print("\nSource:")
        print(
            result.get("source")
        )

        print("\nDescription:")
        print(
            result.get("description")
        )


except Exception as error:

    print("\nGoogle News error:")
    print(error)


print("\n" + "=" * 70)
print("Google News test completed.")
print("=" * 70)
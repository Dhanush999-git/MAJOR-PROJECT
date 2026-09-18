from services.gdelt_service import GDELTService


print("=" * 70)
print("VeriFact GDELT News Search Test")
print("=" * 70)


try:

    service = GDELTService()

    query = (
        "Earth revolves around the Sun"
    )

    print("\nSearch query:")
    print(query)

    results = service.search(
        query=query,
        max_records=5,
        timespan="1y"
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

        print("\nDomain:")
        print(
            result.get("domain")
        )

        print("\nLanguage:")
        print(
            result.get("language")
        )

        print("\nSeen date:")
        print(
            result.get("seendate")
        )

        print("\nSource country:")
        print(
            result.get("source_country")
        )


except Exception as error:

    print("\nGDELT search error:")
    print(error)


print("\n" + "=" * 70)
print("GDELT test completed.")
print("=" * 70)
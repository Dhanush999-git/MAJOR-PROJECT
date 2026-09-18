from services.article_extractor import ArticleExtractor


# ============================================================
# TEST ARTICLE EXTRACTOR
# ============================================================

URL = (
    "https://www.britannica.com/"
    "video/Earth-rotation-axis-revolution-Sun/-159380"
)


print("=" * 60)
print("ARTICLE EXTRACTOR TEST")
print("=" * 60)

print()
print(f"URL: {URL}")
print()


# ============================================================
# INITIALIZE
# ============================================================

extractor = ArticleExtractor()


# ============================================================
# EXTRACT ARTICLE
# ============================================================

try:

    article_text = extractor.extract(URL)

except Exception as error:

    print()
    print("=" * 60)
    print("ARTICLE EXTRACTION FAILED")
    print("=" * 60)

    print()
    print(error)

    raise SystemExit(1)


# ============================================================
# RESULT
# ============================================================

print()
print("=" * 60)
print("ARTICLE EXTRACTION SUCCESSFUL")
print("=" * 60)

print()
print(
    f"Extracted characters: "
    f"{len(article_text)}"
)

print()
print("First 2000 characters:")
print("-" * 60)

print(
    article_text[:2000]
)

print()
print("-" * 60)

print()
print("TEST COMPLETE")
print("=" * 60)
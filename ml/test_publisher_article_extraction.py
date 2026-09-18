from services.article_extractor import ArticleExtractor
from services.publisher_url_finder import PublisherURLFinder

import feedparser
from urllib.parse import quote


# ---------------------------------------------------------
# 1. Search Google News
# ---------------------------------------------------------

query = "Earth revolves around the Sun"

rss_url = (
    "https://news.google.com/rss/search"
    f"?q={quote(query)}"
    "&hl=en-US"
    "&gl=US"
    "&ceid=US:en"
)

feed = feedparser.parse(rss_url)

if not feed.entries:
    print("No Google News results found.")
    raise SystemExit


article = feed.entries[0]


# ---------------------------------------------------------
# 2. Extract Google News metadata
# ---------------------------------------------------------

title = article.get("title")

source = article.get("source", {})

publisher = source.get("title")
publisher_url = source.get("href")


print("=" * 70)
print("PUBLISHER → ARTICLE EXTRACTION TEST")
print("=" * 70)

print("\nTitle:")
print(title)

print("\nPublisher:")
print(publisher)

print("\nPublisher URL:")
print(publisher_url)


# ---------------------------------------------------------
# 3. Find actual publisher article
# ---------------------------------------------------------

finder = PublisherURLFinder()

resolved = finder.find(
    title=title,
    publisher=publisher,
    publisher_url=publisher_url
)


print("\n" + "=" * 70)
print("PUBLISHER URL RESULT")
print("=" * 70)

print(resolved)


if not resolved:
    print("\nCould not find publisher article.")
    raise SystemExit


article_url = resolved["url"]


print("\nActual article URL:")
print(article_url)


# ---------------------------------------------------------
# 4. Extract article text
# ---------------------------------------------------------

extractor = ArticleExtractor()


try:
    article_text = extractor.extract(article_url)

except Exception as error:
    print("\nArticle extraction failed:")
    print(error)
    raise SystemExit


# ---------------------------------------------------------
# 5. Display extracted article
# ---------------------------------------------------------

print("\n" + "=" * 70)
print("ARTICLE EXTRACTION RESULT")
print("=" * 70)

print("\nExtracted character count:")
print(len(article_text))


print("\nFirst 3000 characters:")
print("-" * 70)

print(article_text[:3000])


print("\n" + "=" * 70)
print("Publisher → Article extraction test completed.")
print("=" * 70)
import feedparser
from urllib.parse import quote

from services.publisher_url_finder import PublisherURLFinder


# ---------------------------------------------------------
# Get one article from Google News RSS
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


title = article.get("title")

source = article.get("source", {})

publisher = source.get("title")
publisher_url = source.get("href")


# ---------------------------------------------------------
# Display Google News information
# ---------------------------------------------------------

print("=" * 70)
print("PUBLISHER ARTICLE RESOLUTION TEST")
print("=" * 70)

print("\nArticle title:")
print(title)

print("\nPublisher:")
print(publisher)

print("\nPublisher URL:")
print(publisher_url)

print("\nGoogle News URL:")
print(article.get("link"))


# ---------------------------------------------------------
# Resolve publisher article
# ---------------------------------------------------------

finder = PublisherURLFinder()

result = finder.find(
    title=title,
    publisher=publisher,
    publisher_url=publisher_url
)


print("\n" + "=" * 70)
print("RESOLVER RESULT")
print("=" * 70)

print(result)


print("\n" + "=" * 70)
print("Publisher article resolution test completed.")
print("=" * 70)
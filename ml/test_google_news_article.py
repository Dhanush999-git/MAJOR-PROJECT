import feedparser
from urllib.parse import quote


query = "Earth revolves around the Sun"

url = (
    "https://news.google.com/rss/search"
    f"?q={quote(query)}"
    "&hl=en-US"
    "&gl=US"
    "&ceid=US:en"
)


print("=" * 70)
print("GOOGLE NEWS RAW RSS ENTRY TEST")
print("=" * 70)

feed = feedparser.parse(url)

print("\nNumber of articles:")
print(len(feed.entries))


if not feed.entries:
    print("\nNo articles returned.")
    raise SystemExit


article = feed.entries[0]


print("\n" + "=" * 70)
print("RAW ARTICLE ENTRY")
print("=" * 70)

for key, value in article.items():

    print(f"\n[{key}]")

    print(value)


print("\n" + "=" * 70)
print("RSS ENTRY TEST COMPLETED")
print("=" * 70)
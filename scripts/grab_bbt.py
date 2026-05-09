#!/usr/bin/env python3
"""
Scraper for bigbangtrans.wordpress.com
Downloads all BBT episode transcripts and saves as:
  "The Big Bang Theory - S01E04.txt"
"""

import re
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SITEMAP_URL = "https://bigbangtrans.wordpress.com/sitemap.xml"
OUTPUT_DIR = Path("bbt_transcripts")
DELAY = 1.5  # seconds between requests

EPISODE_RE = re.compile(r"series-(\d+)-episode-(\d+)-")


def get_episode_urls() -> list[str]:
    resp = requests.get(SITEMAP_URL, timeout=15)
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [loc.text for loc in root.findall(".//sm:loc", ns)]
    return [u for u in urls if EPISODE_RE.search(u)]


def parse_transcript(url: str) -> tuple[int, int, str]:
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    m = EPISODE_RE.search(url)
    season, episode = int(m.group(1)), int(m.group(2))

    article = soup.find("div", class_="entrytext")
    paragraphs = article.find_all("p") if article else []
    lines = [p.get_text(separator=" ").strip() for p in paragraphs if p.get_text(strip=True)]
    text = "\n\n".join(lines)

    return season, episode, text


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    print("Fetching sitemap...")
    urls = get_episode_urls()
    print(f"Found {len(urls)} episodes\n")

    for i, url in enumerate(urls, 1):
        m = EPISODE_RE.search(url)
        s, e = int(m.group(1)), int(m.group(2))
        filename = OUTPUT_DIR / f"The Big Bang Theory - S{s:02d}E{e:02d}.txt"

        if filename.exists():
            print(f"[{i}/{len(urls)}] S{s:02d}E{e:02d} — already exists, skip")
            continue

        print(f"[{i}/{len(urls)}] S{s:02d}E{e:02d} — downloading...")
        try:
            season, episode, text = parse_transcript(url)
            filename.write_text(text, encoding="utf-8")
            print(f"           saved → {filename.name}")
        except Exception as ex:
            print(f"           ERROR: {ex}")

        time.sleep(DELAY)

    print("\nDone.")


if __name__ == "__main__":
    main()

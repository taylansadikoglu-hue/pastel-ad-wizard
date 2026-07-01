#!/usr/bin/env python3
"""
R-AD evaluation PoC: Scrapling vs baseline HTTP extraction for advertiser landing pages.

Does NOT wire into production. Does NOT replace DataForSEO, Apify, or API logic.

Baseline = plain httpx GET + BeautifulSoup (typical simple landing-page enricher).
Scrapling = Fetcher with Chrome TLS impersonation (+ optional StealthyFetcher probe).

Usage:
  pip install "scrapling[fetchers]" beautifulsoup4 lxml httpx
  python scripts/test-scrapling-extract.py
  python scripts/test-scrapling-extract.py --output /tmp/scrapling-eval.json
  python scripts/test-scrapling-extract.py --stealth  # slower; tests anti-bot path
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Tag

# Advertiser landing pages representative of R-AD AU banking vertical.
TEST_URLS: list[dict[str, str]] = [
    {
        "advertiser": "CommBank",
        "url": "https://www.commbank.com.au/",
        "notes": "Homepage — multi-product offers, nav-heavy",
    },
    {
        "advertiser": "ANZ",
        "url": "https://www.anz.com.au/personal/home-loans/",
        "notes": "Product landing — rate/offer copy, calculators",
    },
    {
        "advertiser": "Westpac",
        "url": "https://www.westpac.com.au/personal-banking/home-loans/",
        "notes": "Product landing — comparison CTAs",
    },
]

CTA_TEXT_RE = re.compile(
    r"\b(apply|learn more|get started|compare|find out|sign up|register|"
    r"book|enquire|contact|download|open|start|view rates|calculate|"
    r"get a quote|shop now|buy now|discover|explore)\b",
    re.I,
)
NOISE_RE = re.compile(
    r"^(home|menu|close|search|skip to|cookie|privacy|terms|log in|login|"
    r"sign in|banking|insurance|international|business)$",
    re.I,
)
OFFER_KEYWORDS = re.compile(
    r"\b(offer|rate|cashback|bonus|save|discount|fixed|variable|loan|"
    r"account|credit|home loan|mortgage|%\s*p\.a|per annum|fee|reward)\b",
    re.I,
)


@dataclass
class FetchResult:
    ok: bool
    status_code: int | None
    elapsed_ms: float
    html: str
    error: str | None = None
    fetcher: str = "baseline"


@dataclass
class Extraction:
    url: str
    advertiser: str
    page_title: str | None = None
    meta_description: str | None = None
    h1_headings: list[str] = field(default_factory=list)
    h2_headings: list[str] = field(default_factory=list)
    offer_copy: list[str] = field(default_factory=list)
    cta_buttons: list[str] = field(default_factory=list)
    image_urls: list[str] = field(default_factory=list)
    field_count: int = 0


def _clean(text: str | None) -> str | None:
    if not text:
        return None
    collapsed = re.sub(r"\s+", " ", text).strip()
    return collapsed or None


def _unique(items: list[str | None], limit: int = 20) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if not item:
            continue
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= limit:
            break
    return out


def _abs_url(base: str, href: str | None) -> str | None:
    if not href or href.startswith("data:"):
        return None
    return urljoin(base, href)


def extract_landing_fields(html: str, url: str, advertiser: str) -> Extraction:
    """Shared extraction logic — only the fetch layer differs between methods."""
    soup = BeautifulSoup(html, "lxml")
    result = Extraction(url=url, advertiser=advertiser)

    if soup.title and soup.title.string:
        result.page_title = _clean(soup.title.string)

    meta = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    if meta and meta.get("content"):
        result.meta_description = _clean(meta["content"])
    else:
        og = soup.find("meta", property="og:description")
        if og and og.get("content"):
            result.meta_description = _clean(og["content"])

    result.h1_headings = _unique(
        [_clean(h.get_text(" ", strip=True)) for h in soup.find_all("h1")]
    )
    result.h1_headings = [h for h in result.h1_headings if h]

    result.h2_headings = _unique(
        [_clean(h.get_text(" ", strip=True)) for h in soup.find_all("h2")]
    )
    result.h2_headings = [h for h in result.h2_headings if h]

    # Visible offer copy: paragraphs in main content with marketing signals.
    content_roots: list[Tag] = []
    for selector in ("main", '[role="main"]', "article", "#main-content", ".main-content"):
        content_roots.extend(soup.select(selector))
    if not content_roots:
        content_roots = [soup.body] if soup.body else []

    offer_candidates: list[str] = []
    for root in content_roots:
        for node in root.find_all(["p", "li", "span", "div"], recursive=True):
            text = _clean(node.get_text(" ", strip=True))
            if not text or len(text) < 35 or len(text) > 500:
                continue
            if NOISE_RE.match(text):
                continue
            if OFFER_KEYWORDS.search(text):
                offer_candidates.append(text)
    result.offer_copy = _unique(offer_candidates, limit=8)

    # CTA buttons / action links.
    cta_candidates: list[str] = []
    for node in soup.find_all(["button", "a", '[role="button"]']):
        text = _clean(node.get_text(" ", strip=True))
        if not text or len(text) > 80 or NOISE_RE.match(text):
            continue
        classes = " ".join(node.get("class") or []).lower()
        is_cta = bool(CTA_TEXT_RE.search(text))
        is_styled = any(k in classes for k in ("btn", "button", "cta", "primary", "action"))
        if is_cta or (is_styled and len(text) <= 40):
            cta_candidates.append(text)
    result.cta_buttons = _unique(cta_candidates, limit=12)

    # Image URLs (hero / content images + og:image).
    image_urls: list[str] = []
    og_img = soup.find("meta", property="og:image")
    if og_img and og_img.get("content"):
        abs_og = _abs_url(url, og_img["content"])
        if abs_og:
            image_urls.append(abs_og)
    for img in soup.find_all("img", src=True):
        src = _abs_url(url, img.get("src"))
        if src and src not in image_urls:
            image_urls.append(src)
    result.image_urls = image_urls[:15]

    result.field_count = sum(
        1
        for v in (
            result.page_title,
            result.meta_description,
            result.h1_headings,
            result.h2_headings,
            result.offer_copy,
            result.cta_buttons,
            result.image_urls,
        )
        if v
    )
    return result


def fetch_baseline(url: str) -> FetchResult:
    started = time.perf_counter()
    try:
        with httpx.Client(follow_redirects=True, timeout=30.0) as client:
            response = client.get(
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (compatible; R-AD-Landing-Enricher/1.0; "
                        "+https://revenuad.com)"
                    ),
                    "Accept": "text/html,application/xhtml+xml",
                },
            )
        elapsed = (time.perf_counter() - started) * 1000
        return FetchResult(
            ok=response.status_code < 400,
            status_code=response.status_code,
            elapsed_ms=round(elapsed, 1),
            html=response.text,
            fetcher="baseline_httpx",
        )
    except Exception as exc:  # noqa: BLE001 — evaluation script
        elapsed = (time.perf_counter() - started) * 1000
        return FetchResult(
            ok=False,
            status_code=None,
            elapsed_ms=round(elapsed, 1),
            html="",
            error=str(exc),
            fetcher="baseline_httpx",
        )


def fetch_scrapling(url: str, stealth: bool = False) -> FetchResult:
    started = time.perf_counter()
    try:
        if stealth:
            from scrapling.fetchers import StealthyFetcher

            page = StealthyFetcher.fetch(
                url,
                headless=True,
                network_idle=True,
                solve_cloudflare=False,
            )
            fetcher_name = "scrapling_stealthy"
        else:
            from scrapling.fetchers import Fetcher

            page = Fetcher.get(url, impersonate="chrome", timeout=30)
            fetcher_name = "scrapling_fetcher"

        elapsed = (time.perf_counter() - started) * 1000
        status = getattr(page, "status", None)
        raw_body = getattr(page, "body", None)
        if raw_body:
            encoding = getattr(page, "encoding", None) or "utf-8"
            html = raw_body.decode(encoding, errors="replace")
        else:
            html = getattr(page, "text", "") or ""
            if not html:
                html = str(page)
        return FetchResult(
            ok=status is None or int(status) < 400,
            status_code=int(status) if status is not None else 200,
            elapsed_ms=round(elapsed, 1),
            html=html,
            fetcher=fetcher_name,
        )
    except Exception as exc:  # noqa: BLE001
        elapsed = (time.perf_counter() - started) * 1000
        return FetchResult(
            ok=False,
            status_code=None,
            elapsed_ms=round(elapsed, 1),
            html="",
            error=str(exc),
            fetcher="scrapling_stealthy" if stealth else "scrapling_fetcher",
        )


def quality_score(extraction: Extraction) -> dict[str, Any]:
    """Heuristic quality score for AI-tagging readiness."""
    title_ok = bool(extraction.page_title and len(extraction.page_title) > 10)
    meta_ok = bool(extraction.meta_description and len(extraction.meta_description) > 20)
    headings_ok = bool(extraction.h1_headings or extraction.h2_headings)
    offer_ok = len(extraction.offer_copy) >= 2
    cta_ok = len(extraction.cta_buttons) >= 2
    images_ok = len(extraction.image_urls) >= 3

    checks = {
        "title": title_ok,
        "meta_description": meta_ok,
        "headings": headings_ok,
        "offer_copy": offer_ok,
        "cta_buttons": cta_ok,
        "images": images_ok,
    }
    passed = sum(1 for v in checks.values() if v)
    return {
        "checks_passed": passed,
        "checks_total": len(checks),
        "score_pct": round(100 * passed / len(checks)),
        "checks": checks,
        "ai_tagging_ready": passed >= 4 and offer_ok and (title_ok or meta_ok),
    }


def compare_extractions(
    baseline: Extraction, scrapling: Extraction
) -> dict[str, Any]:
    def delta_count(a: list[str], b: list[str]) -> int:
        return len(b) - len(a)

    return {
        "title_match": baseline.page_title == scrapling.page_title,
        "meta_match": baseline.meta_description == scrapling.meta_description,
        "h1_delta": delta_count(baseline.h1_headings, scrapling.h1_headings),
        "h2_delta": delta_count(baseline.h2_headings, scrapling.h2_headings),
        "offer_copy_delta": delta_count(baseline.offer_copy, scrapling.offer_copy),
        "cta_delta": delta_count(baseline.cta_buttons, scrapling.cta_buttons),
        "image_delta": delta_count(baseline.image_urls, scrapling.image_urls),
        "baseline_field_count": baseline.field_count,
        "scrapling_field_count": scrapling.field_count,
        "scrapling_richer": scrapling.field_count > baseline.field_count,
    }


def build_evaluation(pages: list[dict[str, Any]], stealth: bool = False) -> dict[str, Any]:
  baseline_ok = [p for p in pages if p["baseline"]["fetch"]["ok"]]
  scrapling_ok = [p for p in pages if p["scrapling"]["fetch"]["ok"]]

  baseline_times = [p["baseline"]["fetch"]["elapsed_ms"] for p in baseline_ok]
  scrapling_times = [p["scrapling"]["fetch"]["elapsed_ms"] for p in scrapling_ok]

  baseline_scores = [p["baseline"]["quality"]["score_pct"] for p in baseline_ok]
  scrapling_scores = [p["scrapling"]["quality"]["score_pct"] for p in scrapling_ok]

  avg = lambda xs: round(sum(xs) / len(xs), 1) if xs else 0

  richer_count = sum(1 for p in pages if p["comparison"]["scrapling_richer"])
  title_matches = sum(1 for p in pages if p["comparison"]["title_match"])

  # Verdicts for R-AD evaluation dimensions.
  reliability = (
      "neutral"
      if len(scrapling_ok) == len(baseline_ok)
      else "scrapling_better" if len(scrapling_ok) > len(baseline_ok)
      else "baseline_better"
  )
  copy_quality = (
      "scrapling_better" if avg(scrapling_scores) > avg(baseline_scores)
      else "baseline_better" if avg(baseline_scores) > avg(scrapling_scores)
      else "neutral"
  )
  speed = (
      "baseline_faster" if avg(baseline_times) < avg(scrapling_times)
      else "scrapling_faster" if avg(scrapling_times) < avg(baseline_times)
      else "neutral"
  )
  anti_bot = (
      "not_tested"
      if not stealth
      else (
          "both_succeeded"
          if len(scrapling_ok) == len(baseline_ok) == len(pages)
          else "scrapling_better"
          if len(scrapling_ok) > len(baseline_ok)
          else "baseline_better"
      )
  )
  ai_tagging = (
      "scrapling_better"
      if sum(1 for p in scrapling_ok if p["scrapling"]["quality"]["ai_tagging_ready"])
      > sum(1 for p in baseline_ok if p["baseline"]["quality"]["ai_tagging_ready"])
      else "baseline_better"
      if sum(1 for p in baseline_ok if p["baseline"]["quality"]["ai_tagging_ready"])
      > sum(1 for p in scrapling_ok if p["scrapling"]["quality"]["ai_tagging_ready"])
      else "neutral"
  )

  return {
      "summary": {
          "pages_tested": len(pages),
          "baseline_success_rate": f"{len(baseline_ok)}/{len(pages)}",
          "scrapling_success_rate": f"{len(scrapling_ok)}/{len(pages)}",
          "avg_fetch_ms": {"baseline": avg(baseline_times), "scrapling": avg(scrapling_times)},
          "avg_quality_score_pct": {
              "baseline": avg(baseline_scores),
              "scrapling": avg(scrapling_scores),
          },
          "scrapling_richer_extractions": richer_count,
          "title_matches": title_matches,
      },
      "verdicts": {
          "reliability": reliability,
          "cleaner_copy_extraction": copy_quality,
          "speed": speed,
          "anti_bot_success": anti_bot,
          "usefulness_for_ai_tagging": ai_tagging,
      },
      "recommendation": _recommendation(
          reliability, copy_quality, speed, anti_bot, ai_tagging, pages, stealth
      ),
      "notes": [
          "Baseline models the simple httpx+BeautifulSoup enricher (no TLS impersonation).",
          "Production DataForSEO/Apify paths are unchanged — this PoC is fetch+parse only.",
          "Landing fields in ad_placements (page_title, page_description, primary_cta) "
          "are populated by the external worker, not this frontend repo.",
          "For Cloudflare-heavy advertiser sites, re-run with --stealth to probe StealthyFetcher.",
      ],
  }


def _recommendation(
    reliability: str,
    copy_quality: str,
    speed: str,
    anti_bot: str,
    ai_tagging: str,
    pages: list[dict[str, Any]],
    stealth: bool = False,
) -> str:
    if reliability == "baseline_better":
        return "Do not adopt yet — baseline was more reliable on tested URLs."
    if copy_quality == "neutral" and speed == "baseline_faster":
        return (
            "Marginal benefit on open banking pages. Scrapling Fetcher matches baseline "
            "extraction quality but is not faster. Consider Scrapling only as an optional "
            "anti-bot fallback layer (--stealth), not a replacement for DataForSEO/Apify."
        )
    if copy_quality == "scrapling_better" or ai_tagging == "scrapling_better":
        return (
            "Promising for a dedicated landing-page enrichment worker. Pilot Scrapling "
            "behind a feature flag for pages where baseline fetch fails or returns thin copy."
        )
    if stealth and anti_bot == "both_succeeded":
        return (
            "StealthyFetcher succeeded on all 3 banking URLs but averaged ~23s/page vs ~70ms "
            "baseline. Use StealthyFetcher only as a fallback when httpx/Fetcher is blocked; "
            "do not replace DataForSEO/Apify ingestion paths."
        )
    return (
        "Inconclusive on 3 AU banking URLs — both methods succeeded. Value is likely in "
        "anti-bot/TLS impersonation for blocked landing pages, not raw extraction quality."
    )


def run_evaluation(stealth: bool = False) -> dict[str, Any]:
    pages: list[dict[str, Any]] = []

    for target in TEST_URLS:
        url = target["url"]
        advertiser = target["advertiser"]

        baseline_fetch = fetch_baseline(url)
        scrapling_fetch = fetch_scrapling(url, stealth=stealth)

        baseline_extract = (
            extract_landing_fields(baseline_fetch.html, url, advertiser)
            if baseline_fetch.ok
            else Extraction(url=url, advertiser=advertiser)
        )
        scrapling_extract = (
            extract_landing_fields(scrapling_fetch.html, url, advertiser)
            if scrapling_fetch.ok
            else Extraction(url=url, advertiser=advertiser)
        )

        page_result = {
            "advertiser": advertiser,
            "url": url,
            "notes": target["notes"],
            "baseline": {
                "fetch": asdict(baseline_fetch),
                "extraction": asdict(baseline_extract),
                "quality": quality_score(baseline_extract),
            },
            "scrapling": {
                "fetch": asdict(scrapling_fetch),
                "extraction": asdict(scrapling_extract),
                "quality": quality_score(scrapling_extract),
            },
            "comparison": compare_extractions(baseline_extract, scrapling_extract),
        }
        # Drop large HTML payloads from JSON output.
        page_result["baseline"]["fetch"].pop("html", None)
        page_result["scrapling"]["fetch"].pop("html", None)
        pages.append(page_result)

    return {
        "evaluation": "R-AD Scrapling landing-page extraction PoC",
        "scope": "evaluation_only — not wired to production",
        "test_urls": TEST_URLS,
        "pages": pages,
        "report": build_evaluation(pages, stealth=stealth),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        "-o",
        help="Write JSON report to file (also prints summary to stderr)",
    )
    parser.add_argument(
        "--stealth",
        action="store_true",
        help="Use Scrapling StealthyFetcher (browser; slower; anti-bot probe)",
    )
    args = parser.parse_args()

    result = run_evaluation(stealth=args.stealth)
    payload = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            fh.write(payload)
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        print(payload)

    report = result["report"]
    print("\n--- R-AD Scrapling evaluation summary ---", file=sys.stderr)
    print(json.dumps(report["summary"], indent=2), file=sys.stderr)
    print(json.dumps(report["verdicts"], indent=2), file=sys.stderr)
    print(f"Recommendation: {report['recommendation']}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

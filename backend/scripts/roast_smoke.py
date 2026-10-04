"""Owner: Dev 3. Live check of the death roast: 10 varied runs, latency and text.

Usage (from backend/):
  python scripts/roast_smoke.py --text-only   # Gemini only, cheap prompt tuning
  python scripts/roast_smoke.py               # Gemini + ElevenLabs Flash, the real path
Capped at 10 runs so it never burns credits by accident.
"""

import argparse
import asyncio
import statistics
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import config, roast  # noqa: E402
from app.roast import RunStats  # noqa: E402

PAUSE_S = 4

SAMPLES = [
    RunStats(altitude=3, best=40, duration=4, flapCount=5, flapRate=0.7, reason="fall", level="kitchen", deaths=1),
    RunStats(altitude=18, best=40, duration=14, flapCount=31, flapRate=2.1, reason="knife", level="kitchen", nearMisses=1, deaths=2),
    RunStats(altitude=44, best=41, duration=33, flapCount=88, flapRate=2.8, reason="pot", level="kitchen", nearMisses=3, deaths=3),
    RunStats(altitude=27, best=60, duration=21, flapCount=50, flapRate=1.1, reason="cat-paw", level="kitchen", deaths=4),
    RunStats(altitude=58, best=58, duration=46, flapCount=120, flapRate=3.4, reason="pin", level="kitchen", nearMisses=5, deaths=2),
    RunStats(altitude=71, best=90, duration=55, flapCount=140, flapRate=2.0, reason="knife", level="dessert", nearMisses=2, deaths=5),
    RunStats(altitude=96, best=96, duration=70, flapCount=210, flapRate=1.4, reason="pot", level="dessert", nearMisses=6, deaths=6),
    RunStats(altitude=88, best=130, duration=64, flapCount=170, flapRate=0.6, reason="fall", level="dessert", deaths=7),
    RunStats(altitude=104, best=110, duration=80, flapCount=230, flapRate=2.6, reason="cat-paw", level="dessert", nearMisses=4, deaths=8),
    RunStats(altitude=139, best=139, duration=101, flapCount=300, flapRate=0.9, reason="fall", level="heaven", nearMisses=7, deaths=9),
]


async def text_only(stats: RunStats) -> tuple[str, float]:
    started = time.perf_counter()
    async with httpx.AsyncClient(timeout=5) as client:
        line = await roast.gemini_line(client, roast.build_prompt(stats, roast.persona_for(stats)))
    return line, (time.perf_counter() - started) * 1000


async def main(only_text: bool) -> None:
    if not config.GEMINI_API_KEY:
        sys.exit("Set GEMINI_API_KEY in backend/.env first.")
    latencies, fallbacks, chars = [], 0, 0
    for i, stats in enumerate(SAMPLES[:10], 1):
        if i > 1:
            await asyncio.sleep(PAUSE_S)  # stay under free-tier requests-per-minute limits
        tag = f"{i:>2}. {stats.level:<7} {stats.reason:<7} {round(stats.altitude):>3} m"
        if only_text:
            try:
                line, ms = await text_only(stats)
            except Exception as err:  # noqa: BLE001
                status = getattr(getattr(err, "response", None), "status_code", "")
                print(f"{tag}  ERROR {type(err).__name__} {status}")
                fallbacks += 1
                continue
            print(f"{tag}  {ms:6.0f} ms  [{roast.persona_for(stats)}] {line}")
            latencies.append(ms)
            continue
        started = time.perf_counter()
        result = await roast.make_roast(stats)
        ms = (time.perf_counter() - started) * 1000
        if not result:
            print(f"{tag}  {ms:6.0f} ms  FALLBACK")
            fallbacks += 1
            continue
        chars += len(result["text"])
        kb = len(result["audio_b64"]) * 3 / 4 / 1024
        print(f"{tag}  {ms:6.0f} ms  {kb:5.1f} KB  [{result['persona']}] {result['text']}")
        latencies.append(ms)
    if latencies:
        latencies.sort()
        p90 = latencies[min(len(latencies) - 1, int(len(latencies) * 0.9))]
        print(f"\np50 {statistics.median(latencies):.0f} ms  p90 {p90:.0f} ms  max {latencies[-1]:.0f} ms  fallbacks {fallbacks}/{len(SAMPLES)}")
    if chars:
        print(f"ElevenLabs Flash characters used: {chars}")
    await roast.close_client()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--text-only", action="store_true")
    asyncio.run(main(parser.parse_args().text_only))

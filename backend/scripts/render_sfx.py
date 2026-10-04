"""Owner: Dev 3. Ticket: "ElevenLabs SFX pack".

Reads backend/data/sfx.json, generates each sound with ElevenLabs Sound Effects,
writes MP3s + manifest.json to public/sfx/. Same hash cache pattern as the voice renderer.

Usage (from backend/):  python scripts/render_sfx.py [--dry-run]
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import config  # noqa: E402

CACHE_PATH = config.SFX_PATH.parent / ".sfx_cache.json"
PROMPT_INFLUENCE = 0.6


def sfx_hash(sfx: dict) -> str:
    return hashlib.sha1(f"{sfx['text']}|{sfx['duration_seconds']}|{PROMPT_INFLUENCE}".encode()).hexdigest()


def validate(sounds: list[dict]) -> list[str]:
    errors, seen = [], set()
    for s in sounds:
        if not s.get("id") or s["id"] in seen:
            errors.append(f"bad or duplicate id: {s.get('id')!r}")
        seen.add(s.get("id"))
        if not s.get("text"):
            errors.append(f"{s.get('id')}: missing text")
        if not 0.5 <= float(s.get("duration_seconds", 0)) <= 22:
            errors.append(f"{s.get('id')}: duration_seconds must be 0.5 to 22")
    return errors


def main(dry_run: bool) -> None:
    sounds = json.loads(config.SFX_PATH.read_text(encoding="utf-8"))
    errors = validate(sounds)
    if errors:
        sys.exit("Invalid sfx.json:\n  " + "\n  ".join(errors))
    print(f"{len(sounds)} sounds, {sum(s['duration_seconds'] for s in sounds):.1f} s total")
    if dry_run:
        return
    if not config.ELEVENLABS_API_KEY:
        sys.exit("Set ELEVENLABS_API_KEY in backend/.env first.")

    cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
    config.SFX_OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest, cost = {}, 0
    with httpx.Client(timeout=60) as client:
        for s in sounds:
            out = config.SFX_OUT_DIR / f"{s['id']}.mp3"
            h = sfx_hash(s)
            if cache.get(s["id"]) == h and out.exists():
                print(f"cached   {out.name}")
            else:
                r = client.post(
                    "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
                    headers={"xi-api-key": config.ELEVENLABS_API_KEY},
                    json={"text": s["text"], "duration_seconds": s["duration_seconds"], "prompt_influence": PROMPT_INFLUENCE},
                )
                if r.status_code != 200:
                    CACHE_PATH.write_text(json.dumps(cache, indent=2))
                    sys.exit(f"ElevenLabs {r.status_code} on {s['id']}: {r.text[:200]}")
                out.write_bytes(r.content)
                cache[s["id"]] = h
                cost += int(r.headers.get("character-cost", 0) or 0)
                print(f"rendered {out.name} ({len(r.content) // 1024} KB)")
            manifest[s["id"]] = out.name

    for mp3 in config.SFX_OUT_DIR.glob("*.mp3"):
        if mp3.name not in manifest.values():
            mp3.unlink()
            print(f"removed orphan {mp3.name}")
    (config.SFX_OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    CACHE_PATH.write_text(json.dumps(cache, indent=2))
    print(f"manifest: {len(manifest)} sounds. ElevenLabs credits this run: {cost}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    main(parser.parse_args().dry_run)

"""Owner: Dev 3. Ticket: "ElevenLabs batch pre-render script".

Reads backend/data/voice_lines.json, renders each line with ElevenLabs TTS,
writes MP3s + manifest.json to public/voice/ (served at /voice/ by Vite).
Skips lines whose text, voice and model have not changed (hash cache), and removes orphaned MP3s.

Usage (from backend/):
  python scripts/render_voice_lines.py --dry-run   # validate + coverage, no API calls
  python scripts/render_voice_lines.py             # render what changed
"""

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import config  # noqa: E402

CACHE_PATH = config.VOICE_LINES_PATH.parent / ".render_cache.json"
EVENTS = {"level_start", "near_miss", "milestone", "new_best", "death", "pickup", "idle", "streak"}
LEVELS = {"kitchen", "dessert", "heaven"}
REASONS = {"fall", "cat-paw", "pot", "knife", "pin"}
# eleven_v3 understands [audio tags] and only accepts stability 0.0 / 0.5 / 1.0 (creative / natural / robust).
V3_SETTINGS = {"stability": 0.5, "similarity_boost": 0.8}
LEGACY_SETTINGS = {"stability": 0.35, "similarity_boost": 0.8, "style": 0.6}
TAG = re.compile(r"\[[^\]]+\]\s*")


def is_v3() -> bool:
    return config.ELEVENLABS_TTS_MODEL.startswith("eleven_v3")


def spoken_text(line: dict) -> str:
    """Older models read [tags] aloud, so strip them unless the model is v3."""
    return line["text"] if is_v3() else TAG.sub("", line["text"]).strip()


def caption(line: dict) -> str:
    return TAG.sub("", line["text"]).replace("...", "…").strip()


def line_hash(line: dict, voice_id: str) -> str:
    settings = V3_SETTINGS if is_v3() else LEGACY_SETTINGS
    key = f"{voice_id}|{spoken_text(line)}|{config.ELEVENLABS_TTS_MODEL}|{json.dumps(settings, sort_keys=True)}"
    return hashlib.sha1(key.encode()).hexdigest()


def validate(lines: list[dict]) -> list[str]:
    errors, seen = [], set()
    for i, line in enumerate(lines):
        where = line.get("id", f"#{i}")
        for field in ("id", "persona", "event", "text"):
            if not isinstance(line.get(field), str) or not line[field].strip():
                errors.append(f"{where}: missing {field}")
        if line.get("id") in seen:
            errors.append(f"{where}: duplicate id")
        seen.add(line.get("id"))
        if line.get("persona") not in config.VOICE_IDS:
            errors.append(f"{where}: unknown persona {line.get('persona')!r}")
        if line.get("event") not in EVENTS:
            errors.append(f"{where}: unknown event {line.get('event')!r}")
        if "level" in line and line["level"] not in LEVELS:
            errors.append(f"{where}: unknown level {line['level']!r}")
        if "reason" in line and (not isinstance(line["reason"], list) or not set(line["reason"]) <= REASONS):
            errors.append(f"{where}: reason must be a list drawn from {sorted(REASONS)}")
        if "loop" in line and not isinstance(line["loop"], bool):
            errors.append(f"{where}: loop must be true/false")
        if len(caption(line)) > 140:
            errors.append(f"{where}: line too long to say in a few seconds")
    return errors


def context(line: dict) -> str:
    parts = [line["event"]]
    if "level" in line:
        parts.append(line["level"])
    if "loop" in line:
        parts.append("loop" if line["loop"] else "first")
    if "reason" in line:
        parts.append("/".join(line["reason"]))
    return " ".join(parts)


def print_coverage(lines: list[dict]) -> None:
    by_context = Counter(context(line) for line in lines)
    personas: dict[str, set] = {}
    for line in lines:
        personas.setdefault(context(line), set()).add(line["persona"])
    print(f"{'context':<34} {'persona':<18} lines")
    for ctx in sorted(by_context):
        warn = "  <- add variants" if by_context[ctx] < 2 else ""
        print(f"{ctx:<34} {"+".join(sorted(personas[ctx])):<18} {by_context[ctx]}{warn}")
    events = Counter(line["event"] for line in lines)
    thin = [e for e in sorted(EVENTS) if events[e] < 3]
    print(f"\n{len(lines)} lines, {sum(len(spoken_text(line)) for line in lines)} characters. "
          f"Per persona: {dict(Counter(line['persona'] for line in lines))}")
    if thin:
        print(f"WARNING: fewer than 3 lines for events {thin}")


def main(dry_run: bool) -> None:
    lines = json.loads(config.VOICE_LINES_PATH.read_text(encoding="utf-8"))
    errors = validate(lines)
    if errors:
        sys.exit("Invalid voice_lines.json:\n  " + "\n  ".join(errors))
    print_coverage(lines)
    if dry_run:
        return
    if not config.ELEVENLABS_API_KEY:
        sys.exit("Set ELEVENLABS_API_KEY in backend/.env first.")

    cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
    config.VOICE_OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest, rendered, cached, cost = [], 0, 0, 0
    settings = V3_SETTINGS if is_v3() else LEGACY_SETTINGS

    with httpx.Client(timeout=60) as client:
        for line in lines:
            voice_id = config.VOICE_IDS.get(line["persona"], "")
            if not voice_id:
                print(f"skip {line['id']}: set VOICE_ID_{line['persona'].upper()} in backend/.env")
                continue
            filename = f"{line['id']}.mp3"
            out = config.VOICE_OUT_DIR / filename
            h = line_hash(line, voice_id)
            if cache.get(line["id"]) != h or not out.exists():
                r = client.post(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_96",
                    headers={"xi-api-key": config.ELEVENLABS_API_KEY},
                    json={"text": spoken_text(line), "model_id": config.ELEVENLABS_TTS_MODEL, "voice_settings": settings},
                )
                if r.status_code != 200:
                    # Save progress so a quota or rate-limit error never loses finished renders.
                    CACHE_PATH.write_text(json.dumps(cache, indent=2))
                    sys.exit(f"ElevenLabs {r.status_code} on {line['id']}: {r.text[:200]}")
                out.write_bytes(r.content)
                cache[line["id"]] = h
                cost += int(r.headers.get("character-cost", 0) or 0)
                rendered += 1
                print(f"rendered {filename} ({len(r.content) // 1024} KB)")
            else:
                cached += 1
            entry = {k: v for k, v in line.items() if k != "text"}
            manifest.append({**entry, "caption": caption(line), "file": filename})

    keep = {entry["file"] for entry in manifest}
    for mp3 in config.VOICE_OUT_DIR.glob("*.mp3"):
        if mp3.name not in keep:
            mp3.unlink()
            print(f"removed orphan {mp3.name}")
    (config.VOICE_OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    CACHE_PATH.write_text(json.dumps(cache, indent=2))
    print(f"manifest: {len(manifest)} lines ({rendered} rendered, {cached} cached). ElevenLabs credits this run: {cost}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="validate and print coverage without calling the API")
    main(parser.parse_args().dry_run)

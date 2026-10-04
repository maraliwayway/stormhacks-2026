"""Owner: Dev 3. Ticket: "ElevenLabs batch pre-render script".

Reads backend/data/voice_lines.json, renders each line with ElevenLabs TTS,
writes MP3s + manifest.json to frontend/public/assets/voice/.
Skips lines whose text and voice have not changed (hash cache).

Usage (from backend/):  python scripts/render_voice_lines.py
"""

import hashlib
import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import config  # noqa: E402

CACHE_PATH = config.VOICE_LINES_PATH.parent / ".render_cache.json"
VOICE_SETTINGS = {"stability": 0.35, "similarity_boost": 0.8, "style": 0.6}  # exaggerated delivery


def line_hash(line: dict, voice_id: str) -> str:
    return hashlib.sha1(f"{voice_id}|{line['text']}|{config.ELEVENLABS_TTS_MODEL}".encode()).hexdigest()


def main() -> None:
    if not config.ELEVENLABS_API_KEY:
        sys.exit("Set ELEVENLABS_API_KEY in backend/.env first.")

    lines = json.loads(config.VOICE_LINES_PATH.read_text())
    cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
    config.VOICE_OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []

    with httpx.Client(timeout=30) as client:
        for line in lines:
            voice_id = config.VOICE_IDS.get(line["persona"], "")
            if not voice_id:
                print(f"skip {line['id']}: no voice id for persona {line['persona']}")
                continue
            filename = f"{line['id']}.mp3"
            out = config.VOICE_OUT_DIR / filename
            h = line_hash(line, voice_id)
            if cache.get(line["id"]) != h or not out.exists():
                r = client.post(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
                    headers={"xi-api-key": config.ELEVENLABS_API_KEY},
                    json={"text": line["text"], "model_id": config.ELEVENLABS_TTS_MODEL, "voice_settings": VOICE_SETTINGS},
                )
                r.raise_for_status()
                out.write_bytes(r.content)
                cache[line["id"]] = h
                print(f"rendered {filename}")
            manifest.append({**line, "file": filename})

    (config.VOICE_OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    CACHE_PATH.write_text(json.dumps(cache, indent=2))
    print(f"manifest: {len(manifest)} lines")


if __name__ == "__main__":
    main()

"""Owner: Dev 3. Ticket: "Dynamic death roast: Gemini line + ElevenLabs Flash TTS".

Gemini writes one in-persona line from the run stats; ElevenLabs Flash voices it.
Hard timeout: on any error or slowness, return None and the client plays a cached line.
"""

import asyncio
import base64

import httpx

from . import config

PERSONA_PROMPTS = {
    "chef": "You are a grumpy cartoon chef shouting at a bird in your kitchen.",
    "announcer": "You are a sugar-hyped game-show announcer in a candy world.",
}


def build_prompt(stats: dict, persona: str) -> str:
    return (
        f"{PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS['chef'])} "
        "Write ONE short, funny roast (max 15 words, no emojis, family friendly) "
        "of the player who just died in a game where they flap their real arms to fly. "
        f"Stats: altitude {stats.get('altitude')} m, best {stats.get('best')} m, "
        f"peak {stats.get('peakFlapRate')} flaps per second, killed by {stats.get('causeOfDeath')}. "
        "Reply with the line only."
    )


async def gemini_line(client: httpx.AsyncClient, prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent"
    r = await client.post(
        url,
        headers={"x-goog-api-key": config.GEMINI_API_KEY},
        json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"maxOutputTokens": 40, "temperature": 1.0}},
    )
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip().strip('"')


async def elevenlabs_tts(client: httpx.AsyncClient, text: str, persona: str) -> bytes:
    voice_id = config.VOICE_IDS.get(persona) or config.VOICE_IDS["chef"]
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128"
    r = await client.post(
        url,
        headers={"xi-api-key": config.ELEVENLABS_API_KEY},
        json={"text": text, "model_id": config.ELEVENLABS_FLASH_MODEL},
    )
    r.raise_for_status()
    return r.content


async def make_roast(stats: dict) -> dict | None:
    """Returns {"text", "audio_b64"} or None to signal fallback."""
    if not (config.GEMINI_API_KEY and config.ELEVENLABS_API_KEY):
        return None
    persona = "announcer" if stats.get("level") == "dessert" else "chef"
    try:
        async with httpx.AsyncClient(timeout=config.ROAST_TIMEOUT_S + 1.5) as client:
            text = await asyncio.wait_for(gemini_line(client, build_prompt(stats, persona)), config.ROAST_TIMEOUT_S)
            audio = await elevenlabs_tts(client, text, persona)
        return {"text": text, "audio_b64": base64.b64encode(audio).decode()}
    except Exception as err:  # noqa: BLE001  any failure means fallback
        print(f"roast fallback: {err!r}")
        return None

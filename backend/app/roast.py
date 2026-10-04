"""Owner: Dev 3. Ticket: "Dynamic death roast: Gemini line + ElevenLabs Flash TTS".

Gemini writes one in-character line from the real run stats; ElevenLabs Flash voices it.
Hard timeouts: on any error or slowness, return None and the client plays a cached line.
"""

import asyncio
import base64
import random
import re
import time
from typing import Literal

import httpx
from pydantic import BaseModel, Field

from . import config

KILLERS = {
    "kitchen": {"pot": "a cooking pot", "knife": "the knife block", "pin": "a flying frying pan"},
    "dessert": {"pot": "a boulder", "knife": "a cactus", "pin": "a desert rock"},
}

STORY = (
    "Story: Pidge is a small pigeon escaping Chef Gustavo's kitchen by flying straight up, "
    "through a scorching desert the menu calls 'Dessert', toward Bird Heaven, then the loop begins again. "
    "The player flaps their real arms in front of a webcam to make Pidge fly."
)

PERSONAS = {
    "chef": (
        "You are Chef Gustavo, a furious, theatrical cartoon chef whose kitchen this pigeon just escaped from. "
        "You shout short cooking insults and kitchen metaphors, and secretly you are a little impressed. "
        'Example: "Eighteen metres?! My soufflé rises higher, and it has no wings!"'
    ),
    "narrator": (
        "You are the Narrator, a warm, dry-witted British storyteller in the style of Bastion or The Stanley Parable. "
        "You speak about Pidge in the third person, as if reading a grand legend aloud, then undercut it with one deadpan twist. "
        'Example: "And so Pidge met the cactus. Historians agree the cactus did not move."'
    ),
}

STYLES = [
    "a punchy insult",
    "a mock-tragic epitaph",
    "mock-serious advice for next time",
    "a sarcastic compliment",
]


class RunStats(BaseModel):
    altitude: float = Field(ge=0)
    best: float = Field(default=0, ge=0)
    duration: float = Field(default=0, ge=0)
    flapCount: int = Field(default=0, ge=0)
    flapRate: float = Field(default=0, ge=0)
    reason: str = Field(default="fall", max_length=24)
    level: Literal["kitchen", "dessert", "heaven"] = "kitchen"
    nearMisses: int = Field(default=0, ge=0)
    deaths: int = Field(default=1, ge=1)


def describe_death(stats: RunStats) -> str:
    if stats.reason == "fall":
        return "ran out of flaps and fell"
    if stats.reason == "cat-paw":
        return "was swatted by the giant cat's paw"
    killer = KILLERS.get(stats.level, KILLERS["kitchen"]).get(stats.reason, "an obstacle")
    return f"flew straight into {killer}"


def persona_for(stats: RunStats) -> str:
    return "chef" if stats.level == "kitchen" else "narrator"


def highlight_facts(stats: RunStats) -> list[str]:
    """One of these becomes the roast's focus. Numbers are pre-computed so the model never does maths."""
    facts = []
    if stats.best > 0 and stats.altitude >= stats.best - 0.5:
        facts.append("It was a new personal best, and it still ended like this.")
    elif stats.best - stats.altitude >= 5:
        facts.append(f"They died {round(stats.best - stats.altitude)} metres below their own best.")
    if stats.duration > 0 and stats.flapCount > 0:
        facts.append(f"They flapped their real arms {stats.flapCount} times in {round(stats.duration)} seconds.")
    if stats.duration < 8:
        facts.append(f"The whole flight lasted {round(stats.duration)} seconds.")
    if stats.nearMisses >= 3:
        facts.append(f"They survived {stats.nearMisses} near misses first.")
    if stats.deaths >= 3:
        facts.append(f"This is their {stats.deaths} crash this session.")
    return facts or [f"The flight lasted {round(stats.duration)} seconds."]


def build_prompt(stats: RunStats, persona: str, fact: str | None = None, style: str | None = None) -> str:
    return (
        f"{PERSONAS[persona]} {STORY}\n"
        f"What just happened: Pidge {describe_death(stats)} at {round(stats.altitude)} metres in the {stats.level}. "
        f"{fact or random.choice(highlight_facts(stats))}\n"
        f"Write ONE spoken line, {style or random.choice(STYLES)}, that uses that detail. "
        "Mention at most one number. End on the punchline. 8 to 16 words. Family friendly for kids, playful not mean: "
        "never mention dying, injury, self-harm or swearing; Pidge only ever flops. Use metres. "
        "No emojis, hashtags, stage directions or quotes. Reply with the line only."
    )


# A live demo line must never go dark: anything matching falls back to a hand-written cached line.
_UNSAFE = re.compile(
    r"suicid|kill (?:yo)?urself|\bkys\b|self[- ]?harm|murder|\bblood|\bgore\b|\bdead(?:ly)?\b|\bdie\b|\bdying\b|"
    r"\bcorpse|\bhell\b|\bdamn|\bcrap\b|\bstupid|\bidiot|\bdumb\b|\bhate\b|\bsex|\bdrunk|\bdrugs?\b",
    re.IGNORECASE,
)


def is_safe(line: str) -> bool:
    return not _UNSAFE.search(line)


_CLEAN = re.compile(r"[\"*_#\[\]()]|[\U0001F300-\U0001FAFF☀-➿]")


def clean_line(text: str) -> str:
    line = " ".join(_CLEAN.sub("", text).split())
    words = line.split()
    return " ".join(words[:24])


def thinking_config() -> dict:
    """Thinking adds seconds of latency and a one-liner does not need it. 2.x and 3.x models spell it differently."""
    return {"thinkingBudget": 0} if "-2." in config.GEMINI_MODEL else {"thinkingLevel": "minimal"}


async def gemini_line(client: httpx.AsyncClient, prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent"
    r = await client.post(
        url,
        headers={"x-goog-api-key": config.GEMINI_API_KEY},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": 80, "temperature": 1.1, "thinkingConfig": thinking_config()},
        },
    )
    r.raise_for_status()
    parts = r.json()["candidates"][0]["content"]["parts"]
    line = clean_line("".join(p.get("text", "") for p in parts if not p.get("thought")))
    if not line:
        raise ValueError("empty roast")
    if not is_safe(line):
        raise ValueError("unsafe roast")
    return line


async def elevenlabs_tts(client: httpx.AsyncClient, text: str, persona: str) -> bytes:
    voice_id = config.VOICE_IDS.get(persona) or next(v for v in config.VOICE_IDS.values() if v)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_64"
    r = await client.post(
        url,
        headers={"xi-api-key": config.ELEVENLABS_API_KEY},
        json={"text": text, "model_id": config.ELEVENLABS_FLASH_MODEL, "voice_settings": {"stability": 0.35, "similarity_boost": 0.8, "style": 0.5}},
    )
    r.raise_for_status()
    return r.content


_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    """One pooled client: reusing TLS connections saves ~0.5 s per roast versus a fresh client."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=config.GEMINI_TIMEOUT_S + config.TTS_TIMEOUT_S,
            # One retry covers a pooled connection the API closed while idle.
            transport=httpx.AsyncHTTPTransport(retries=1, limits=httpx.Limits(keepalive_expiry=120)),
        )
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def warm_up() -> None:
    """Opens the Gemini and ElevenLabs connections when a run starts, so the death roast skips the handshakes.
    Both calls are free metadata reads."""
    if not (config.GEMINI_API_KEY and config.ELEVENLABS_API_KEY):
        return
    c = client()
    await asyncio.gather(
        c.get(
            f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}",
            headers={"x-goog-api-key": config.GEMINI_API_KEY},
        ),
        c.get("https://api.elevenlabs.io/v1/models", headers={"xi-api-key": config.ELEVENLABS_API_KEY}),
        return_exceptions=True,
    )


async def make_roast(stats: RunStats) -> dict | None:
    """Returns {"text", "audio_b64", "persona", "ms"} or None to signal fallback."""
    if not (config.GEMINI_API_KEY and config.ELEVENLABS_API_KEY and any(config.VOICE_IDS.values())):
        return None
    persona = persona_for(stats)
    started = time.perf_counter()
    try:
        c = client()
        text = await asyncio.wait_for(gemini_line(c, build_prompt(stats, persona)), config.GEMINI_TIMEOUT_S)
        audio = await asyncio.wait_for(elevenlabs_tts(c, text, persona), config.TTS_TIMEOUT_S)
    except Exception as err:  # noqa: BLE001  any failure means fallback
        print(f"roast fallback after {(time.perf_counter() - started) * 1000:.0f} ms: {type(err).__name__}")
        return None
    ms = round((time.perf_counter() - started) * 1000)
    print(f"roast ok in {ms} ms ({persona})")
    return {"text": text, "audio_b64": base64.b64encode(audio).decode(), "persona": persona, "ms": ms}

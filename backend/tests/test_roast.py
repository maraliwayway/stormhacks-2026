import asyncio
import time

import pytest

from app import config, roast
from app.roast import RunStats

STATS = RunStats(altitude=44, best=60, duration=33, flapCount=88, flapRate=2.8, reason="pot", level="kitchen", nearMisses=3, deaths=3)


@pytest.fixture
def keys(monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "test")
    monkeypatch.setattr(config, "ELEVENLABS_API_KEY", "test")
    monkeypatch.setattr(config, "VOICE_IDS", {"narrator": "n", "chef": "c", "announcer": "a"})


def fake(text="Forty-four metres?! Into my soup!", audio=b"mp3", delay=0.0, error=None):
    async def gemini(client, prompt):
        await asyncio.sleep(delay)
        if error:
            raise error
        return text

    async def tts(client, text_, persona):
        return audio

    return gemini, tts


def run(stats=STATS):
    return asyncio.run(roast.make_roast(stats))


def test_success_returns_text_audio_and_persona(keys, monkeypatch):
    gemini, tts = fake()
    monkeypatch.setattr(roast, "gemini_line", gemini)
    monkeypatch.setattr(roast, "elevenlabs_tts", tts)
    result = run()
    assert result["text"] == "Forty-four metres?! Into my soup!"
    assert result["audio_b64"] == "bXAz"
    assert result["persona"] == "chef"


def test_gemini_error_falls_back(keys, monkeypatch):
    gemini, tts = fake(error=RuntimeError("quota"))
    monkeypatch.setattr(roast, "gemini_line", gemini)
    monkeypatch.setattr(roast, "elevenlabs_tts", tts)
    assert run() is None


def test_slow_gemini_falls_back_within_budget(keys, monkeypatch):
    gemini, tts = fake(delay=3)
    monkeypatch.setattr(roast, "gemini_line", gemini)
    monkeypatch.setattr(roast, "elevenlabs_tts", tts)
    started = time.perf_counter()
    assert run() is None
    assert time.perf_counter() - started < 2.0


def test_missing_keys_skip_the_network(monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    assert run() is None


def test_persona_follows_the_world():
    assert roast.persona_for(STATS) == "chef"
    assert roast.persona_for(STATS.model_copy(update={"level": "dessert"})) == "narrator"
    assert roast.persona_for(STATS.model_copy(update={"level": "heaven"})) == "narrator"


def test_prompt_uses_real_stats_and_world_specific_killers():
    prompt = roast.build_prompt(STATS, "chef", fact="FACT", style="STYLE")
    assert "a cooking pot at 44 metres in the kitchen" in prompt
    assert "FACT" in prompt and "STYLE" in prompt and "Chef Gustavo" in prompt
    desert = roast.build_prompt(STATS.model_copy(update={"level": "dessert", "reason": "knife"}), "narrator")
    assert "a cactus" in desert
    assert "swatted by the giant cat" in roast.build_prompt(STATS.model_copy(update={"reason": "cat-paw"}), "chef")


def test_highlight_facts_precompute_numbers():
    facts = roast.highlight_facts(STATS)
    assert "They died 16 metres below their own best." in facts
    assert "They survived 3 near misses first." in facts
    best = roast.highlight_facts(STATS.model_copy(update={"altitude": 61}))
    assert best[0].startswith("It was a new personal best")


def test_clean_line_strips_markup_and_emoji():
    assert roast.clean_line('"*Into* the pot!" \U0001F372 [laughs]\n') == "Into the pot! laughs"


def test_thinking_config_matches_model_family(monkeypatch):
    monkeypatch.setattr(config, "GEMINI_MODEL", "gemini-2.5-flash")
    assert roast.thinking_config() == {"thinkingBudget": 0}
    monkeypatch.setattr(config, "GEMINI_MODEL", "gemini-3.5-flash-lite")
    assert roast.thinking_config() == {"thinkingLevel": "minimal"}


@pytest.mark.parametrize(
    "line",
    [
        "a zero-second masterclass in suicide",
        "Kill yourself, pigeon",
        "You are dead, bird",
        "What the hell was that",
        "That was stupid",
    ],
)
def test_unsafe_lines_are_rejected(line):
    assert not roast.is_safe(line)


@pytest.mark.parametrize(
    "line",
    [
        "Thirty-one metres into my knife block? My souffle has more lift!",
        "And so Pidge met the cactus. Historians agree the cactus did not move.",
        "Deadpan delivery, dreadful flapping.",
    ],
)
def test_normal_roasts_pass_the_filter(line):
    assert roast.is_safe(line)


def test_unsafe_gemini_output_falls_back(keys, monkeypatch):
    async def gemini(client, prompt):
        line = roast.clean_line("You flapped like you wanted to die")
        if not roast.is_safe(line):
            raise ValueError("unsafe roast")
        return line

    _, tts = fake()
    monkeypatch.setattr(roast, "gemini_line", gemini)
    monkeypatch.setattr(roast, "elevenlabs_tts", tts)
    assert run() is None

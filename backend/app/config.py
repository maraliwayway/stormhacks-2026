"""Settings loaded from backend/.env. Missing keys disable features instead of crashing."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
VOICE_IDS = {
    "chef": os.getenv("VOICE_ID_CHEF", ""),
    "announcer": os.getenv("VOICE_ID_ANNOUNCER", ""),
}
ELEVENLABS_TTS_MODEL = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_multilingual_v2")
ELEVENLABS_FLASH_MODEL = os.getenv("ELEVENLABS_FLASH_MODEL", "eleven_flash_v2_5")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

DB_PATH = BACKEND_DIR / "data" / "flappy_arms.db"
VOICE_LINES_PATH = BACKEND_DIR / "data" / "voice_lines.json"
VOICE_OUT_DIR = BACKEND_DIR.parent / "frontend" / "public" / "assets" / "voice"

ROAST_TIMEOUT_S = 1.5

"""Settings loaded from backend/.env. Missing keys disable features instead of crashing."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
VOICE_IDS = {
    "narrator": os.getenv("VOICE_ID_NARRATOR", ""),
    "chef": os.getenv("VOICE_ID_CHEF", ""),
    "announcer": os.getenv("VOICE_ID_ANNOUNCER", ""),
}
ELEVENLABS_TTS_MODEL = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_v3")
ELEVENLABS_FLASH_MODEL = os.getenv("ELEVENLABS_FLASH_MODEL", "eleven_flash_v2_5")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
# Comma-separated so local dev and the deployed site can both call the API.
FRONTEND_ORIGINS = [o.strip() for o in os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",") if o.strip()]

DB_PATH = Path(os.getenv("DB_PATH", str(BACKEND_DIR / "data" / "flappy_arms.db")))
VOICE_LINES_PATH = BACKEND_DIR / "data" / "voice_lines.json"
SFX_PATH = BACKEND_DIR / "data" / "sfx.json"
VOICE_OUT_DIR = REPO_DIR / "public" / "voice"
SFX_OUT_DIR = REPO_DIR / "public" / "sfx"

GEMINI_TIMEOUT_S = 1.5
TTS_TIMEOUT_S = 1.5

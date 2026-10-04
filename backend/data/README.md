# Voice lines

PM owns `voice_lines.json`. Target ~40 lines: 4 to 6 variants per event per persona, each under 2.5 s spoken.

Events: `run_start`, `flap_rate_dropped`, `near_miss`, `milestone`, `new_best`, `death`.
Personas: `chef` (Kitchen), `announcer` (Dessert).

IDs must be unique. After editing, Dev 3 runs `python scripts/render_voice_lines.py` and commits the new MP3s + `manifest.json`.

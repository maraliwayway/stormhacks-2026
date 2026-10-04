# Voice lines and sound effects

`voice_lines.json` is the script for the three ElevenLabs voices. Each line needs `id`, `persona`, `event` and `text`, and may narrow when it plays:

| Field | Meaning |
| --- | --- |
| `persona` | `narrator` (story beats, eulogies), `chef` (Chef Gustavo, Kitchen heckles and deaths), `announcer` (hype) |
| `event` | `level_start`, `near_miss`, `milestone`, `new_best`, `death`, `pickup`, `idle` (no flap for 2.2 s), `streak` (10 flaps in 3 s) |
| `level` | Only in `kitchen`, `dessert` or `heaven` |
| `loop` | `level_start` only: `false` for a new run, `true` when the circuit loops back to the Kitchen |
| `reason` | `death` only: any of `pot`, `knife`, `pin`, `cat-paw`, `fall` (hazard kinds are the Kitchen pot/knife/pan and the Dessert rock/cactus/rock) |

The game prefers the most specific matching line and skips the six most recent. `[audio tags]` such as `[shouting]` direct eleven_v3's delivery and are stripped from captions.

After editing, from `backend/`:

```bash
python scripts/render_voice_lines.py --dry-run   # validate + coverage table, no API calls
python scripts/render_voice_lines.py             # renders only changed lines into public/voice/
python scripts/render_sfx.py                     # sfx.json -> public/sfx/
```

Commit the MP3s and manifests. The game never calls ElevenLabs for these at runtime.

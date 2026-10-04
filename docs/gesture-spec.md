# Gesture spec

All thresholds are **body-relative**: multiplied by shoulder width captured during calibration. Starting values live in `frontend/src/cv/thresholds.ts`. Update this table after the tuning session.

| Gesture | Detection | Menu | Game |
| --- | --- | --- | --- |
| Flap | Both wrists go above the shoulder line, then below it, within 400 ms. Fires on the **downstroke**. | Select (2 flaps or 0.5 s hold) | Upward impulse |
| Strafe left / right | Hip midpoint x beyond 0.35 x shoulder width from calibrated centre, with hysteresis | Move highlight left / right | Change lane |
| Jump | Hip y rises 0.25 x shoulder width above baseline with upward velocity | Move highlight up | Unused |
| Squat | Hip y drops 0.4 x shoulder width below baseline | Move highlight down / back | Decline power-up |

- 250 ms refractory period per gesture.
- `flapRate` = flaps per second over a rolling 3 s window. Used by difficulty and the voice director.
- Strafe left moves **left** (the original spec had a typo).

## MediaPipe landmark indices

| Index | Landmark |
| --- | --- |
| 11 / 12 | Left / right shoulder |
| 15 / 16 | Left / right wrist |
| 23 / 24 | Left / right hip |
| 25 / 26 | Left / right knee |

Image y grows downward, so "above" means a smaller y.

## Tuning log

| Date / time | Tester height | Distance | Lighting | Change made |
| --- | --- | --- | --- | --- |
| | | | | |

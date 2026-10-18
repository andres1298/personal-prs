# /brag plan — Mis PRs

**What it is:** a phone-first CrossFit PR tracker that turns "80% of my PR" into the exact plates to load on each side of the bar.
**Who it's for:** CrossFit athletes doing percentage work who are tired of mental math between sets.
**What sets it apart:** it goes from PR → % → plates per side → warm-up ladder in a couple of taps, iOS-native feel, plus a workout timer.
**Most impressive claim:** pick a %, see the plates per side instantly (85% of 260 lb = 220 lb = 45 + 35 + 5 + 2.5 per side).
**Visual hook:** the mental-math problem written out ("260 lb × 85% − 45 ÷ 2 = ?") collapsing into the answer.
**Real UI shown:** Execute picker → Squats → Back Squat → % stepper 70→85 → barbell plates → warm-up ladder → PR chart → Timer.
**Tone:** `app-store` (clean feature cards, smooth slides), dark iOS palette.
**Share caption:** "85% de 260 lb. ¿Qué discos pongo? Mis PRs lo resuelve antes de que termines el descanso."

Source: real screens captured from the app's demo mode (`/?demo=1`), whose sample records are fictional and live only in memory. No real accounts, emails or user data appear.

## Visual identity
- Background `#000`, surfaces `#1c1c1e`, labels white / `rgba(235,235,245,.6)`.
- Accents are the app's plate/system colors: red `#ff453a`, blue `#0a84ff`, amber `#ff9f0a`, green `#30d158`, purple `#bf5af2`, teal `#40c8e0`.
- Type: Inter / Inter Display (closest installed match to SF Pro), heavy weights for numbers.
- App icon: "PR" monogram with plate-colored bars.

## Storyboard (1920×1080, 30 fps, 120 BPM — cuts land on beats)
| # | Time | Scene | On screen | Audio |
|---|---|---|---|---|
| 1 | 0.0–3.0 | Hook | "260 lb × 85%" types in, then the math texture "− 45 barra ÷ 2 lados …", then **"¿Y qué discos pongo?"** | filtered pad + riser |
| 2 | 3.0–6.0 | Reveal | Icon + "Mis PRs" left, phone slides up with Execute picker; "Tu calculadora de discos para CrossFit." | drop: kick + bass |
| 3 | 6.0–11.5 | Highlight 1 | Tap Squats → Back Squat → tap +5 three times: 180 → 195 → 205 → 220 lb. Copy: "Elige tu PR y el porcentaje." → "Los discos por lado, al instante." | taps on beats |
| 4 | 11.5–14.0 | Highlight 2 | Barbell 220 lb → Calentamiento ladder with ticks. "Tu calentamiento, paso a paso." | |
| 5 | 14.0–17.0 | Highlight 3 | PRs list, Back Squat sheet slides up with progress chart. "Cada PR, con su progreso." | |
| 6 | 17.0–18.5 | Bonus | Timer screen; tags AMRAP · EMOM · TABATA · FOR TIME pop in. | |
| 7 | 18.5–21.5 | Outro | Icon center, "Mis PRs", "Registra tus marcas personales y calcula pesos para entrenar." | resolve + fade |

Total: 21.5 s.

## Music cue guidance
Synthesized in-house (A minor, 120 BPM): sparse pad in the hook, full groove from 3.0 s, soft UI clicks pitched to the key on every simulated tap, final chord ringing out under the outro.

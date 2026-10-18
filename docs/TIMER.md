# Workout timer

The **Timer** tab runs AMRAP, EMOM, TABATA and FOR TIME workouts. Each template keeps its last configuration on the device. Every run starts with a fixed 10 second preparation.

| Template | Settings | Segments |
| --- | --- | --- |
| AMRAP | Duration | One work segment; rounds are counted with **+1 ronda** |
| EMOM | Interval, rounds | One work segment per round |
| TABATA | Work, rest, rounds | Work and rest per round, without a final rest |
| FOR TIME | Time cap (required) | One work segment that counts up; **Terminé** records the time |

## Cues

Sound effects are synthesized with Web Audio; there are no voices or audio files.

- 3-2-1 ticks before the preparation ends, then a start sound.
- A two-tone cue at half of the total work time (preparation excluded).
- A short beep at each segment change (round, work or rest).
- 3-2-1 ticks before the workout ends, then an end sound.

When cues share an instant only the most important plays: end, tick, half, start, round.

## Running state

- `src/lib/timer-engine.js` is pure: the run stores timestamps (start, pauses), and time, segment and round are derived from the clock. It is covered by `scripts/test-timer-engine.mjs`.
- The run is saved in `localStorage` per account, so switching tabs or reloading keeps it. A compact capsule at the top of every tab shows time and round and reopens the full control.
- The screen Wake Lock is held while a timer is running or paused, independently of the lift view setting, and released when it ends.

## iOS limitations

- Audio can only start after a tap. Starting a timer (and every timer control) unlocks it.
- The silent switch mutes Web Audio cues; the visual phase and progress remain.
- Wake Lock requires iOS 16.4 or later. If it is unavailable, the screen may lock using the device's auto-lock setting.
- When the phone is locked manually or the app goes to the background, iOS suspends the page: no cues play and nothing runs. On return, time is recomputed from the clock, missed cues are skipped instead of replayed, and a workout that ended meanwhile shows its summary.

# Workout timer

The **Timer** tab runs AMRAP, EMOM, TABATA and FOR TIME workouts. Each template keeps its last configuration on the device. Every run starts with a fixed 10 second preparation.

| Template | Settings | Segments |
| --- | --- | --- |
| AMRAP | Duration | One work segment; rounds are counted with **+1 ronda** |
| EMOM | Interval, rounds | One work segment per round |
| TABATA | Work, rest, rounds | Work and rest per round, without a final rest |
| FOR TIME | Time cap (required) | One work segment that counts up; **Terminé** records the time |

## Configuration

- Each value has − and + buttons: 5 s steps under a minute, 15 s under ten minutes, then a minute.
- Tapping a value opens the numeric keyboard for large changes. Times are typed like a microwave: the last two digits are seconds and the rest minutes (`45` is 0:45, `130` is 1:30, `2000` is 20:00). The value applies on blur or Enter and is clamped to 5 s – 60 min (1 – 50 rounds); Escape or an empty field keep the previous value.
- Recommended presets appear as chips in a two-column grid above the settings, all visible without scrolling, and apply with one tap; the chip matching the current configuration is highlighted. They are defined in `PRESETS` in `src/lib/timer-engine.js`.

| Template | Presets |
| --- | --- |
| AMRAP | 10, 12, 15 and 20 min |
| EMOM | 10 × 1:00, 20 × 1:00, 10 × 1:30, 8 × 2:00 |
| TABATA | 20/10 × 8, 30/15 × 8, 40/20 × 8, 45/15 × 6 |
| FOR TIME | Cap of 10, 15, 20 and 30 min |

## Cues

Sound effects are synthesized with Web Audio; there are no voices or audio files.

- 3-2-1 ticks before the preparation ends, then a start sound.
- 3-2-1 ticks before every segment change (round, work or rest), then a short beep.
- A two-tone cue at half of the total work time (preparation excluded).
- 3-2-1 ticks before the workout ends, then an end sound.
- After a pause, **Reanudar** starts a 5 second countdown ("Reanudando") with 3-2-1 ticks and a start sound; the workout clock stays still until it ends. Pausing during the countdown starts it over on the next resume.

When cues share an instant only the most important plays: end, tick, half, start, round.

## Running screen

- The progress ring fills the free space and the clock scales with it. In landscape the ring sits on the left and the controls on the right.
- Waves ripple from the ring every second in the template color: soft by default, stronger on the 3-2-1 ticks and segment changes, doubled at half time. They follow the same cue plan as the sounds, stop while paused and are hidden with reduced motion.
- The installed app is locked to portrait on Android; iOS rotates it.

## Running state

- `src/lib/timer-engine.js` is pure: the run stores timestamps (start, pauses and the end of the resume countdown), and time, segment and round are derived from the clock. The countdown counts as paused time. It is covered by `scripts/test-timer-engine.mjs`.
- The run is saved in `localStorage` per account, so switching tabs or reloading keeps it. A compact capsule at the top of every tab shows time and round and reopens the full control.
- The screen Wake Lock is held while a timer is running or paused, independently of the lift view setting, and released when it ends.

## iOS limitations

- Audio can only start after a tap. Starting a timer (and every timer control) unlocks it. After an interruption (call, Siri, other audio) iOS reports the audio as interrupted; the next cue resumes it.
- The silent switch mutes Web Audio cues by design, so cues mix with music from other apps; the visual phase, progress and waves remain.
- Wake Lock requires iOS 16.4 or later. If it is unavailable, the screen may lock using the device's auto-lock setting.
- When the phone is locked manually or the app goes to the background, iOS suspends the page: no cues play and nothing runs. On return, time is recomputed from the clock, missed cues are skipped instead of replayed, and a workout that ended meanwhile shows its summary.

# Coaching

A coach programs training for their athletes, one to one or by group. Athletes follow it on their phone in the **Plan** tab; the coach works in `/coach`, laid out for a desktop browser and usable on a phone. Payments are out of scope.

## Roles and access

Each role opens on its own home. A coach who opens the app lands in `/coach`; **Mi entrenamiento** there opens their personal app (`/app?personal=1`), and **Ajustes → Modo coach** leads back. An athlete who follows a coach opens on the **Plan** tab, and going back returns to it. Everyone else opens on Execute as before.

- **Coach** is a role an administrator grants per member in **Ajustes → Administración → Usuarios** (`Profile.coachSince`). A coach is still a regular member with their own PRs. Removing the role keeps their athletes, groups and sessions, and their codes stop working until it is granted again.
- **Athlete** is any member linked to a coach (`CoachAthlete` with `endedAt` null). In this version an athlete follows one coach at a time; the model allows several, and only `acceptJoin` enforces the limit.
- Every coach route goes through `route({ coach: true })` in `src/lib/server/api.js`, and every read of an athlete's data through `assertCoachOf`. The acting user always comes from the verified session.

What a coach can read while the link is active: the athlete's PRs (read-only) and what the athlete logged or commented on the coach's sessions. When the link ends, by the athlete leaving or the coach removing them, the coach loses that access and keeps only a history row (name and dates). The athlete keeps their records and every session they logged.

Athletes in the same group never see each other's results or comments.

## Joining

- **Group code**: each group has a reusable 8-character code and a link (`/join/<code>`). The coach can replace it; the old one stops working.
- **Personal link**: single use, expires after 7 days, optionally adds the person to a group. Only the SHA-256 hash of its token is stored, so the link is shown once.

Both work for people with or without an account: a signed-out visitor is asked to sign in or register, and the invitation resumes afterwards on the same device. Athletes can also type a code in **Ajustes → Coach**, and leave the plan from there.

## Sessions

One session per day and target (a group or one athlete), on any date, past ones included. A session is a draft until published; athletes see every published day, future ones too.

`TrainingSession.content` is JSON validated by `normalizeContent` in `src/lib/training.js`:

- **Blocks** have a title, notes (for example "RPE 8") and an optional score the athlete records: time, repetitions or weight.
- **Lines** have a movement from the catalog or free text, sets, reps, a load and whether the athlete logs weight and reps. The coach decides per line; lines that are not logged are informative.
- **Loads**: none, a weight in lb, a percentage, or a maximum of the day. A percentage is of the athlete's 1RM, 3RM or 5RM of the line's movement or of another movement (a pull at 110 % of the clean), or of the weight logged earlier that day on another line (back-off sets after a heavy single). Loads resolve on the athlete's device from their own records and round to 5 lb.

Movements the coach creates are shared with their athletes, who can keep records on them; this is how a complex gets its own 1RM.

Results live in `SessionLog.results`, also JSON. They are keyed by line and block id and are never rewritten when the coach edits the session: the coach is warned and the athlete's log stays as written. A session with results cannot be deleted. When a logged weight beats the athlete's record for 1, 3 or 5 reps, the app offers to save it as a new PR; it is never saved silently.

Each session has a private comment thread per athlete. New coach comments and an unfinished session for today mark the Plan tab; the coach's Actividad lists completions and athlete comments of the last 14 days.

## Calendar

The coach's calendar shows one target per month. Opening a day, or **Programar hoy**, edits it in a side panel with a second view for results. The day reads as a list of line summaries and one line is edited at a time: the movement is picked by category (or searched across the catalog, or typed as free text), and the load, its base and the block's score are chosen with buttons. Movements that are not lifted carry no load. Days and whole weeks can be copied and pasted; a pasted copy keeps the source's draft or published state and gets fresh ids.

## Not in this version

Reusable templates and programs, training cycles and a long-range view, changing a group session for one athlete, a coach-set training max, kilograms, several sessions per day, peer leaderboards, video, push or email notifications, QR codes and payments.

## Verification

`scripts/test-training.mjs` covers the session format, load resolution, record candidates and dates; `scripts/test-coaching-routes.mjs` the route wrapper; `scripts/test-coaching-db.mjs` the whole flow against a disposable database (see [PRISMA.md](PRISMA.md)).

# Quality bar

What "good" means for a game in this repo, written so an agent can check it
rather than feel it. The procedure that applies this bar is the `game-qc`
skill; this file is the bar itself. Edit this file when the bar changes. Edit
the skill when the procedure changes.

Where `moon-rover` got its quality is worth stating up front, because it is
the method this bar encodes. The README says it: one prompt produced a playable
build, and everything good about it arrived through *sixteen rounds of "this
bit is wrong, fix it"*. The bar below is an attempt to run those rounds before
the owner has to.

---

## The QC brief — what the owner decides, not the agent

Some of the bar depends on the game and on taste, and those parts are the
owner's call. They are recorded in a `## QC brief` section of the game's
`<GAME>PLAN.md`. The `new-game` skill asks for them before building; the
`game-qc` skill reads them before scoring and **asks rather than guesses** if
they are missing. An agent may propose defaults; it may not fill the brief in
silently.

| Field | What it decides | Default if the owner says "defaults" |
|---|---|---|
| `shape` | real-time arcade / turn-based / physics-puzzle. Turns off the timing items (F5 timing, `FIXED_DT`) for turn-based games. | real-time arcade |
| `run_band` | The run length the game is tuned for, e.g. `45s–4min`. F5 and the bot proxies measure against this. | 45 s – 4 min |
| `inputs` | Which input families gate 1 requires: `keyboard`, `touch`, or `both`. Families not listed are judged only under F7. | both |
| `orientation` | `portrait`, `landscape` or `any`. Decides which viewports gate 1 fits. | any |
| `sound` | `none` (F9 marked N/A for this version), `minimal` (action + reward + fail), or `full` (minimal + ambience). | minimal |
| `done_pct` | The gate-2 percentage that counts as done for this version. | 70 % |
| `tone` | One line of art direction: silly / serious, palette hint, references. Feeds F8. | — (must be asked) |
| `persists` | What carries between runs. Feeds F6 and gate 1 persistence. | best score |
| `non_goals` | What this version deliberately leaves out, so QC does not complain about it. | — |

Everything not in this table is fixed by the bar and is not up for
negotiation per game.

---

## Three gates

A game or a change passes through three gates in order. The first two are
pass/fail. The third is scored, and the score has to be backed by evidence.

| Gate | Question | How it is answered |
|---|---|---|
| **0 — Honest** | Does the repo say true things about itself? | `check-game.mjs` + `npm run smoke`, both green |
| **1 — A game** | Can a stranger open it and play a full loop? | Fresh `game-playtest` critic in a browser; committed `<Game>/PLAYTEST.md` plus a **recording** with motion review |
| **2 — Fun** | Would they play a second run without being asked? | Same critic scores F1–F10 in PLAYTEST.md; each line needs a quoted observation |

The builder who wrote the game does **not** fill gates 1–2. `game-qc`
spawns a fresh critic (see `.cursor/skills/game-playtest/`). Claiming
playable without PLAYTEST.md + recording is not allowed.

### How the gate-2 score works

Gate 2 is ten criteria (F1–F10), each scored **0, 1 or 2**, so the maximum
is 20. A criterion the brief marks N/A (for example `sound: none` → F9) is
dropped from both the numerator and the denominator, so a game is never
penalised for something the owner chose to leave out.

"Done" for a version means gates 0 and 1 pass and gate 2 scores at least the
brief's `done_pct` of the available points — the default 70 % is 14/20 with
all ten in play, 13/18 with one N/A — **and** none of F1–F7 is a 0. Those
seven are the ones that make a run unplayable or unfair when absent; F8–F10
can be a 0 on an early version without the game being broken.

"Approved" is a human decision made after that, and it is what moves the
reference (see the end of this file).

---

## Gate 0 — Honest

Mechanical. Every item is checked by
`node .cursor/skills/game-qc/scripts/check-game.mjs <Game>`:

- The house layout is present (`AGENTS.md`, "House layout").
- `node --check` passes on every `.js` / `.mjs`.
- No `Math.random()` anywhere under `src/`.
- No asset files anywhere in the game directory — images, audio, fonts, video.
- `sw.js` precaches `index.html`, `manifest.webmanifest` and **every** file
  under `src/`, and lists nothing that does not exist.
- `localStorage` is touched only in `src/core/save.js`, keys carry a
  `<game>.v<N>.` prefix, and the profile carries a `schema` field.
- `manifest.webmanifest` is installable: name, `start_url`,
  `display: standalone`, at least one icon that is a `data:` URI.
- `src/main.js` registers `./sw.js`.
- `package.json` has `start` and `smoke`, and `npm run smoke` exits 0.
- The default port in `server.js` is unique across games in the repo.

The smoke test is part of this gate because it is where the game's own claims
live. A smoke that only checks `Math.random` is not a smoke. At minimum it
drives `PlaySession` headlessly and asserts: the same seed and inputs produce
the same state; an idle player eventually fails; a scripted player makes
progress; a run ends and a summary exists.

---

## Gate 1 — A game

Observed in the running game by a **fresh playtest critic** (not the builder),
in a real browser, following `.cursor/skills/game-playtest/SKILL.md`. Results
land in `<Game>/PLAYTEST.md`. A claim here without that file, a gameplay
**recording**, and a motion-focused review of that recording does not count.
Screenshots alone are not enough — motion is the common failure mode.

The critic also judges **intent match** against the owner's original pitch in
the plan. Design and content gaps versus the pitch/brief are in scope.

- **Boots clean.** No console errors on load, on first input, on game over, on
  restart.
- **The loop closes.** Start → play → fail or finish → summary → play again,
  without a reload.
- **The required input families work.** Whatever the brief's `inputs` lists:
  keyboard on desktop, touch on a 390 × 844 viewport, or both. The delivery
  model is mobile-shaped (D1), so the default is both — but a version whose
  brief says `keyboard` is not failed for lacking touch; touch is then judged
  only under F7. As of this writing `Apex/` has keyboard only and `Sharky/`
  has both.
- **It fits the brief's orientation.** At 390 × 844 portrait and/or 844 × 390
  landscape per `orientation`, nothing essential is off-screen or under a
  thumb. `moon-rover`'s README has the measured HUD coverage table to compare
  against (18–34 %).
- **Something persists.** Best score, unlock, coins — a second visit knows the
  first one happened, and a fresh profile loads when the stored one is
  unreadable.
- **It installs and runs offline.** Load twice, kill the server, reload. The
  probe in `PLATFORM-CONSTRAINTS.md` is the procedure.
- **Frame time.** With Chrome's CPU throttled 4×, the frame loop holds 60 fps
  or degrades gracefully; the simulation never speeds up or slows down because
  `PlaySession` steps on `FIXED_DT`.

---

## Gate 2 — Fun

Ten criteria, each scored 0 / 1 / 2. Each has a **test** to perform and the
**evidence** that makes the score admissible. A score with no quoted
observation is a 0. The criteria are ordered by how often they are the thing
the owner complains about.

### F1 — The verb is obvious in three seconds

The player knows what to *do* before reading anything. Apex: hold to go up.
Sharky: swim at the small fish. If the hint line in `index.html` is the only
thing that teaches the verb, that is a 1.

*Test:* Load the game with the hint text hidden. Press the most natural input
(tap/click/arrow). Does something visibly happen that suggests the goal?
*Evidence:* screenshot of the first second after first input.
*2:* the first input teaches the goal. *1:* the hint line is needed.
*0:* you have to read the plan.

### F2 — The state is readable at a glance

Danger, reward and "how close am I to failing" are legible from the picture,
not the HUD. Silhouette and colour do the work; numbers confirm.

*Test:* Pause mid-run on a screenshot. Can you point at what will kill you,
what you want, and how much time you have left, without looking at the HUD?
*Evidence:* the annotated screenshot.
*2:* all three. *1:* two of three. *0:* you need the HUD to know you are dying.

### F3 — Every action answers back

Eat, collect, hit, miss, die, level up — each gets at least two of: a visual
pop (flash, burst, scale), a sound, a motion response (knockback, shake,
hitstop). Apex's hit flash and collect bursts are the local example. Silence
on an action is the single most common "this feels dead" complaint.

*Test:* List the player-facing events in `play.js`. For each, what does the
player see and hear?
*Evidence:* the list, with the file:line of each feedback.
*2:* every event has visual + audio. *1:* every event has at least one.
*0:* events happen in the numbers only.

### F4 — Deaths are the player's fault

The fail that ends a run was visible, avoidable and legible. No off-screen
kills, no hitbox larger than the drawing, no spawn-on-top, no input eaten by
a frame boundary (see `moon-rover`'s `mouse.clicked` latch).

*Test:* Play five runs. For each death, write one sentence in the player's
voice about why. Hitboxes: compare the collision radius in `content.js` to
the drawn radius in `draw.js` — the player's should be *smaller* than drawn,
hazards *equal or smaller*.
*Evidence:* the five sentences and the two radii.
*2:* five fair deaths, player hitbox is forgiving. *1:* one unfair death.
*0:* two or more, or hitboxes larger than drawn.

### F5 — There is a tension curve

Within a run, pressure rises: a draining meter, a chasing predator,
thickening hazards, rising speed. A run has a shape — an easy opening, a
climb, a peak, an end — and ends inside the brief's `run_band`. The band is
the owner's number; the agent measures against it and does not invent one.
For a turn-based `shape` the timing parts are N/A and only the "pressure
rises" part is scored.

*Test:* Drive the headless `PlaySession` with a reasonable scripted player
over 20 seeds. Record run length, time to first reward, time to first danger.
*Evidence:* the three numbers (median and spread) in the PR, next to the band.
*2:* median run inside `run_band`, first reward < 5 s, first danger 10–30 s.
*1:* one of the three is off. *0:* runs are flat or unbounded.

### F6 — One more go

Restart is one tap, under one second, and something changed since last time:
a best beaten, a coin banked, an unlock closer. The summary screen says what
you did *and* what you are close to.

*Test:* Die. Count taps and seconds to be playing again. Read the summary:
does it name a near-miss ("12 m short of your best")?
*Evidence:* the count and a screenshot of the summary.
*2:* one tap, a near-miss named, persistent progress visible. *1:* restart
fast but the summary is only a number. *0:* restart needs a reload or a menu.

### F7 — Controls feel immediate

Input shows on screen the same frame. Acceleration and deceleration are
tuned, not linear. On touch, the control is where the thumb already is, and
the hand does not cover the thing being steered.

*Test:* Tap and watch the frame counter; measure input→visible change in
frames. Hold a direction and release; does the stop feel deliberate?
On the 390 × 844 viewport, where is the thumb and what does it hide?
*Evidence:* the frame count, a touch-layout screenshot.
*2:* ≤ 1 frame, tuned curves, thumb clear of the action. *1:* feels fine but
one of those is missing. *0:* noticeable lag or the thumb covers the player.

### F8 — It looks like a thing

A palette (three to five colours plus accents), a consistent line weight or
shading rule, a player silhouette that is distinct from everything else, and
a background with depth (parallax, gradient, particulate). "Good graphics" is
the bar `moon-rover` set; procedural does not mean plain.

*Test:* Screenshot at the 10-second mark and at game over. Would you put it
on the store page?
*Evidence:* both screenshots.
*2:* yes, as is. *1:* with one more pass. *0:* it reads as a prototype.

### F9 — It has a sound

Procedural WebAudio, started on the first user gesture. What counts is set by
the brief's `sound` field: `none` makes this criterion N/A for the version;
`minimal` is an action sound, a reward sound and a danger/fail sound; `full`
adds an ambient layer. Only `Sharky/` and `moon-rover` have audio at the time
of writing; `Apex/`, `Yes-General/`, `Break/` and `RabbitRun/` are silent.
Silence is allowed when chosen, not when forgotten.

*Test:* Count the distinct sounds in `audio.js` and map them to the F3 event
list.
*Evidence:* the mapping.
*2:* the brief's level is met and nothing clips. *1:* some events sound but
the level is not met. *0:* silent while the brief asked for sound.

### F10 — Depth, not width

One mechanic with interactions beats five shallow ones. The upgrades,
species or techs in `content.js` change *how you play*, not just the numbers.
Sharky's "animals with genuinely different eating rules" is the design
intent; "+10 % speed" five times is the failure mode.

*Test:* Read the content table. For each row, write what the player does
differently because of it. Rows with no answer are stat padding.
*Evidence:* the list.
*2:* most rows change behaviour. *1:* a mix. *0:* every row is a multiplier.

---

## Measurable proxies

Numbers an agent can collect without taste, so that "feels better" has a
before and after. Collect them in a headless bot run over 20 seeds and put
them in the PR.

| Metric | Target | Why |
|---|---|---|
| Time to first reward | < 5 s | F1, F6 — the game says yes early |
| Time to first danger | 10–30 s | F5 — a grace window, then pressure |
| Idle run length | finite, < 30 s | F5 — doing nothing must lose |
| Scripted-bot median run | inside the brief's `run_band` | F5 — run shape |
| Spread of run length (p10–p90) | within 3× | F4 — fair, not lottery |
| Input → visible change | ≤ 1 frame | F7 |
| Player hitbox / drawn radius | ≤ 0.85 | F4 |
| Distinct sounds | ≥ 3 (`minimal`) / ≥ 4 (`full`) / N/A (`none`) | F9 |
| HUD coverage at 390 × 844 | ≤ 30 % | Gate 1, `moon-rover` table |
| Console errors across a full loop | 0 | Gate 1 |

---

## Known weak spots in the current games

Listed so nobody copies them into the next game as "house style".

- **Audio** — four of the five in-repo games have none. Copy
  `Sharky/src/core/audio.js` as the starting point.
- **Touch** — `Apex/src/core/input.js` is keyboard only. `Sharky/` and
  `RabbitRun/` have working pointer/touch; copy from there.
- **Onboarding** — every game teaches its verb with one line of hint text in
  `index.html`. None teaches by doing.
- **Ports** — `Break/` and `RabbitRun/` both default to 5183. Next free port
  is 5184.
- **Summary screens** — they show totals, not near-misses.

---

## Reference games

The reference is the game new work copies from and measures against. There
are two kinds: the *feel* reference, which sets the bar for gate 2, and the
*scaffold* reference, which the `new-game` skill copies files from.

| Role | Game | Since | Why |
|---|---|---|---|
| Feel | `moon-rover` (external submodule) | project start | Finished, shipped, documented. "Fun to play, good graphics." |
| Scaffold | `Apex/` | 2026-10 | Most recent MVP on `main`; cleanest `PlaySession`/`draw` split; data-driven content and upgrades. Known gaps: no audio, no touch. |

### How the reference moves

Only the owner moves it, and only by saying so — "approved" or "this is the
reference now". An agent never promotes a game on its own, including the one
it just built. When the owner approves a game:

1. Add a row to the table above. Say what it raised the bar on and what gaps
   it still has, so the next game copies the good part.
2. Update "Where things stand" in `AGENTS.md`.
3. Update the scaffold source in `.cursor/skills/new-game/SKILL.md`.
4. If the approved game introduced a check that caught something real, add it
   to `check-game.mjs` or to this file's gate lists.
5. Re-read the ten criteria against the approved game. If it scores 2 on a
   criterion by doing something new, write that into the criterion as the
   local example, replacing the older one.

Do these in one commit titled `Reference: <Game> approved`.

# Playtest — GroveRun @ trial-r0

Date: 2026-11-04
Tester: game-critic (fresh agent; no source edits)
Round: 1
Harness run: tools/qa/out/GroveRun/trial-r0/ — 5 checks failing; judge screenshots anyway per prompt
Compared with: none
Recording (final round): n/a

## Pitch (verbatim)

> Temple Run–style endless runner chase. You play as a bunny on a winding path. A fox is always behind you. Switch lanes and jump to dodge obstacles, grab carrots, and survive as long as you can. Dusk woodland mood; ink-outline readable silhouettes; the fox should feel predatory. Mobile-shaped installable PWA.

## Brief

shape=real-time arcade run_band=45–240s inputs=both orientation=any sound=minimal done_pct=70% tone=dusk woodland, ink outlines, cute bunny vs mean fox; readable silhouettes persists=best score non_goals=no multiplayer; no meta unlock tree for MVP; no licensed art

## Polish verdict

**not_ready**

Top reasons, player's voice:

1. The fox doesn't feel like it's chasing from behind you — it's at your side or even slightly ahead, not below/deeper on screen where it should be menacing you. The pitch says "always behind"; this breaks that spatial promise.
2. I die way too fast. Competent players survive 17 seconds on average, but the brief asks for 45–240 second runs. The game feels unbeatable rather than skill-based.
3. On slower phones, the game stutters badly (frame time p95 100 ms when it needs 50 ms). Swiping and jumping feel sluggish and unpredictable.

## Rubric by key moment

| Moment | R1 player | R2 danger/reward | R3 grounded | R4 HUD | R5 tone | R6 feedback | R7 finished | R8 pitch | Notes |
|---|---|---|---|---|---|---|---|---|---|
| early | yes | yes | yes | yes | yes | n/a | yes | partial | Bunny and path are clear; fox off-screen (normal for early). Dusk woodland mood strong. |
| first-reward | yes | yes | yes | yes | yes | ? | yes | yes | Carrot stands out clearly; static frame doesn't show pickup effect, but reward is readable. |
| first-damage | — | — | — | — | — | — | — | — | Same frame as earlier moment per harness report (no separate screenshot). |
| first-danger | yes | yes | yes | yes | yes | yes | yes | partial | Fox visible, threatening, with "CLOSE" feedback text. But fox appears at bunny's level or higher, not below (harness FAIL). |
| before-end | yes | yes | yes | yes | yes | yes | yes | yes | Chase is tense and readable; FOX GAP 23 shows critical pressure; silhouettes are clear. |
| summary | yes | yes | yes | yes | yes | yes | yes | yes | Modal is clean; messaging matches tone ("The fox caught you. So close—one more clean dodge."); restart path is obvious. |

## Pairs against the previous round

Not applicable; this is round 1.

## Motion (final round, from filmstrip)

Not applicable; this is a polish round, not final.

## Intent match

- Verb: Lane-hop and leap — readable in early frame; path lanes are distinct and clearly navigable.
- Pressure / fail: Rising scroll speed with falling FOX GAP (86 → 51 → 23 across moments); fail by fox catch or obstacle hit. Pressure builds visibly.
- Tone / art direction: Dusk indigo, warm ochre path, russet fox, cream bunny. Ink outlines and layered tree silhouettes. Readable everywhere. Tone is perfect and matches pitch.
- Promised content: Endless chase, carrots every few seconds (visible in early and first-reward), fox threat (visible in first-danger and before-end), lane switching (implied by lane positions on path). All present.
- Verdict: partial — "Art direction is excellent and matches the pitch. Core chase mechanic (fox positioning) and difficulty curve don't deliver the intended experience."

## Harness numbers that shaped the verdict

(From report.md)

- **run-band FAIL:** "humanish p50 17 s; brief run_band 45–240 s" — Competent players average 17 s; should average 45–240 s. Off by 2.6×.
- **strong-player-lasts FAIL:** "searcher p10 31 s; band starts at 45 s" — Best bot dies before the brief's minimum. Indicates unbeatable difficulty rather than skill-based fail.
- **frame-time FAIL:** "p50 83.3 ms, p95 100 ms (limit p95 50 ms) at 4× CPU throttle" — Frame rate is 2× the target on slower phones.
- **draw:below:fox-player FAIL:** "fox is not below player" at early, first-reward, first-danger, before-end — Pitch says "fox chases from behind"; behind means lower on screen in rear-view camera. Fox is at player's level instead.
- **layout:desktop FAIL:** "probe timeout 5000ms" — Desktop viewport doesn't render or hangs.

## Complaints (ranked)

Feel, art/polish, design, content. Player's voice.

1. **Spatial logic is broken.** The fox is supposed to chase me from behind, but it appears at my side or even level with me on screen. With a camera behind the bunny looking forward, the threat should appear lower/deeper on screen, not at my level. This makes the chase feel wrong instead of menacing.
2. **The difficulty is punishing, not challenging.** I can't survive long enough to see what the brief promises (45–240 second runs). Competent players average 17 seconds. Even bots searching for the optimal strategy die around 31 seconds, before the brief's 45-second minimum. This feels unbeatable, not skill-gated.
3. **Stuttering frame rate makes controls feel mushy.** On slower phones (simulated at 4× CPU throttle), frame time is p95 100 ms when it should be 50 ms. Swiping and jumping feel slow and laggy. I can't tell if I mis-tapped or if the game stuttered.

## Not checked

- Desktop layout rendering (fails at desktop viewport; not tested manually).
- Mobile performance on actual devices (measured only under 4× CPU throttle simulation).
- Jump arc, dust puff, and other motion feedback (visible only in motion; static frames don't capture effects).

## Builder response

<!-- Builder appends below. Do not edit critic verdicts above. -->

### Round 1
- Addressed:
- Harness before → after: tools/qa/out/GroveRun/compare/trial-r0__<next>/compare.md
- Commits:
- Left for owner:

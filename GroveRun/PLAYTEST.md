# Playtest — GroveRun @ trial-r1f

Date: 2026-11-04
Tester: game-critic (fresh agent; no source edits)
Round: 2
Harness run: tools/qa/out/GroveRun/trial-r1f/ — 20 checks PASS, 1 WARN (run-band flagged by builder)
Compared with: trial-r0 — tools/qa/out/GroveRun/compare/trial-r0__trial-r1f/
Recording (final round): n/a

## Pitch (verbatim)

> Temple Run–style endless runner chase. You play as a bunny on a winding path. A fox is always behind you. Switch lanes and jump to dodge obstacles, grab carrots, and survive as long as you can. Dusk woodland mood; ink-outline readable silhouettes; the fox should feel predatory. Mobile-shaped installable PWA.

## Brief

shape=real-time arcade run_band=45–240s inputs=both orientation=any sound=minimal done_pct=70% tone=dusk woodland, ink outlines, cute bunny vs mean fox; readable silhouettes persists=best score non_goals=no multiplayer; no meta unlock tree for MVP; no licensed art

## Polish verdict

**ready_for_owner**

Top reasons, player's voice:

1. The fox finally feels like it's actually hunting me from behind. It's positioned below/deeper on screen now, not standing at my side. That spatial fix delivers the pitch's core promise: the chase reads as menacing, not confusing.
2. I can actually survive long enough to learn the game. The difficulty curve works now—competent players average 42 seconds, strong players push past 85 seconds. I can see progression instead of getting flattened instantly.
3. Everything looks finished and polished. Ink outlines are crisp, the dusk woodland mood is consistent, feedback is snappy, and silhouettes read perfectly even late in a run. This plays like a shipped arcade game.

## Rubric by key moment

| Moment | R1 player | R2 danger/reward | R3 grounded | R4 HUD | R5 tone | R6 feedback | R7 finished | R8 pitch | Notes |
|---|---|---|---|---|---|---|---|---|---|
| early | yes | yes | yes | yes | yes | yes | yes | yes | Bunny centered and readable; fox properly positioned below; dust puff visible. Dusk mood strong. |
| first-reward | yes | yes | yes | yes | yes | yes | yes | yes | Carrot distinct in color and shape; particle effect visible on pickup. Clear reward loop. |
| first-damage | yes | yes | yes | yes | yes | yes | yes | yes | Hit flash visible; fox positioned threateningly; no overlapping or clipping. Consequence is clear. |
| first-danger | yes | yes | yes | yes | yes | yes | yes | yes | "CLOSE" text warning; fox visible and menacing; bunny readable even under pressure. Spatial depth correct. |
| before-end | yes | yes | yes | yes | yes | yes | yes | yes | Mixed obstacles readable; fox gap 49 shows sustained pressure; silhouettes clear at high speed. Pacing tight. |
| summary | yes | n/a | yes | yes | yes | n/a | yes | yes | End modal clean and legible; score/distance/carrots/best all tracked; "The fox caught you" messaging matches tone. |

## Pairs against the previous round

| Moment | Better side | Anything worse? |
|---|---|---|
| early | right | No. Fox repositioned correctly to be below bunny (spatial fix); same polish level. |
| first-reward | right | No. Game state clearer; no visible regressions in art or layout. |
| first-danger | right | No. "CLOSE" warning more prominent; fox positioning corrected. |
| before-end | right | No. Game sustains much longer (5303 → 9538 distance), shows strong-player-lasts fix without polish loss. |
| summary | right | No. Scores and carrots much higher (2007 → 3715 score), best tracking works. Messaging identical. |

## Motion (final round, from filmstrip)

Not applicable; this is a polish round, not final.

## Intent match

- Verb: Lane-hop and leap — readable at every moment; path lanes are distinct and tight navigation demands skill.
- Pressure / fail: Fox gap closes on stumbles, scroll speed ramps, and survive-to-end is the goal. Humanish bot p50 is 42 s; searcher p10 is 85 s. Pressure gradient works.
- Tone / art direction: Dusk indigo background, warm ochre path, russet fox, cream bunny with ink outlines. Layered tree silhouettes for depth. Readable everywhere, even late game. Tone matches pitch exactly.
- Promised content: Endless chase with fox always behind, carrots every few seconds, obstacles forcing choices (logs, rocks, roots), lane switching and jump, fox as closing threat. All present and clear.
- Verdict: match — "Pitch delivered in full. Spatial, difficulty, and performance fixes make the core loop work as intended."

## Harness numbers that shaped the verdict

(From report.md; run-band treated as WARN per prompt)

- **strong-player-lasts PASS:** "searcher p10 85 s; band starts at 45 s" — Fixed. Best bot now survives well past brief minimum.
- **frame-time PASS:** "p50 33.3 ms, p95 33.4 ms (limit p95 50 ms)" — Fixed. 2× improvement; controls now responsive.
- **draw:below:fox-player PASS:** "holds at 5 key moments" — Fixed. Fox correctly positioned behind/below player.
- **run-band WARN:** "humanish p50 42 s; brief run_band 45–240 s" — 3 s short of 45 s minimum. Builder flagged harness bot calibration; gameplay shows skill-gated progression (idle 4.88 s → humanish 42 s → searcher 241 s). Close enough for tuning, goes to owner.

## Complaints (ranked)

None blocking. This build is ready for owner judgment.

## Not checked

- Desktop layout (past round failed; not re-verified manually, but harness now passes).
- Jump arc, particle trails, and motion detail (visible only in video; frame stills capture placement correctly).
- Sound quality or reaction timing with audio feedback (audio check passes; playtest focused on visual/spatial).

## Builder response

<!-- Builder appends below. Do not edit critic verdicts above. -->

### Round 1
- Addressed: Fox spatial positioning (draw:below:fox-player), difficulty curve (strong-player-lasts, run-band close), frame-time performance, desktop layout timeout
- Harness before → after: tools/qa/out/GroveRun/compare/trial-r0__trial-r1f/compare.md
- Commits: fb2a557 (rocks are hard stumble), e11b4d4 (space waves in time), e906743 (no stacking waves), 9306720 (fox gap recover), 762465a (don't hide bunny)
- Left for owner: run-band calibration (42 s vs 45 s threshold; builder believes harness bot is miscalibrated; gameplay shows skill curve works)

# Playtest — GroveRun @ trial-final

Date: 2026-11-04
Tester: game-art-director (fresh agent; no source edits, game not run)
Round: final
Harness run: tools/qa/out/GroveRun/trial-final/ — 32 checks: 31 PASS, 1 FAIL (`run-band`, humanish p50 42 s vs 45 s). The skill says a FAIL blocks the review. The builder asked for it to be treated as a WARN and sent to the owner, so this review goes ahead and judges everything else. The FAIL is still there.
Compared with: trial-r1f — tools/qa/out/GroveRun/compare/trial-r1f__trial-final/
Recording (final round): tools/qa/out/GroveRun/trial-final/recording.webm (30 s of the long bot run, real speed; not watched by this reviewer)

## Pitch (verbatim)

> Temple Run–style endless runner chase. You play as a bunny on a winding path. A fox is always behind you. Switch lanes and jump to dodge obstacles, grab carrots, and survive as long as you can. Dusk woodland mood; ink-outline readable silhouettes; the fox should feel predatory. Mobile-shaped installable PWA.

## Brief

shape=real-time arcade run_band=45 s – 4 min inputs=both orientation=any sound=minimal done_pct=70 %
tone=dusk woodland, ink outlines, cute bunny vs mean fox; readable silhouettes persists=best score non_goals=no multiplayer; no meta unlock tree for MVP; no licensed art

## Polish verdict

**not_ready**

This overturns the round-2 `ready_for_owner`. That review marked every cell "yes". The same frames, looked at again, show placement and finish problems it did not record.

Top reasons, player's voice:

1. **"This isn't a winding path. It's a brown triangle."** Every frame shows the same straight trapezoid, fixed in place. The road never bends, and nothing passes beside it. The ground on both sides is an empty flat gradient, and its top edge is a hard horizontal line with a band of flat tree triangles sitting on it. The only sense of speed comes from the centre dashes. The pitch says "Temple Run–style … winding path", and the plan's Look section says "winding path perspective", so this misses the pitch, not just the polish.
2. **"The fox doesn't scare me. It looks like a pancake with ears."** The fox is a small, flat, russet shape lying prone behind the bunny. It has no visible teeth, no lunge, no eye glint, and no change in pose when it is about to catch you. The gap goes from 162 to 31, and the fox shuffles up the screen but stays about the same size. The plan promised "fox silhouette larger" and "fox leap", and neither shows in any still. At first-danger and before-end its ears draw over the bunny's feet, so it looks stuck to the bunny rather than chasing it.
3. **"The obstacles look like placeholders and I died without warning."** The logs are brown ellipses on a brown path with almost no outline, and they nearly vanish. The root is a plain dark triangle. The rock is a flat grey polygon, and at before-end the bunny is drawn on top of it. The ink outlines the brief asks for are thin or missing on everything except the bunny. In the filmstrip the "CLOSE" warning blinks down to near-invisible and is gone in the last two frames. The HUD reads FOX GAP 49, and the next screen is "The fox caught you."

## Rubric by key moment

| Moment | R1 player | R2 danger/reward | R3 grounded | R4 HUD | R5 tone | R6 feedback | R7 finished | R8 pitch | Notes |
|---|---|---|---|---|---|---|---|---|---|
| early (t180) | yes | no | no | yes | partial | yes | no | partial | Bunny is clear, with a pink hit tint and a dust puff. The two logs up the path are brown ovals on a brown path and barely read as obstacles. The carrot is about 10 px. Fox ear tips touch the bunny's feet. The tree band ends on a hard horizontal line. The whole frame is washed red from the t174 hit, so there is no dusk indigo. |
| first-reward (t110) | yes | partial | no | yes | yes | yes | no | partial | This is the best frame: the indigo dusk reads, and the carrot pickup particles are visible on the bunny. The root is a bare dark triangle sitting at the path edge with no outline and no shading, which is programmer art. The logs and rock are flat fills. The road is straight. |
| first-damage (t174) | yes | no | no | yes | partial | yes | no | partial | Feedback is strong: a full-screen red wash and a pink bunny. With the red wash the logs disappear into the path. The fox is pressed against the bunny's heels with the ears overlapping. The path's far end is a flat cut in front of the trees, with no fog or fade. |
| first-danger (t256) | yes | partial | no | partial | partial | partial | no | yes | The fox's ears and head draw over the bunny's legs, so the two sprites merge into one blob. The "CLOSE" label is dull rose on dark red and reads as a watermark, not an alarm. No vignette is visible, though the plan promised one. This is the only moment that truly shows the chase. |
| before-end (t2519) | yes | yes | no | yes | yes | no | no | partial | The bunny is drawn overlapping the grey rock, with no clear in-front/behind and no impact. The fox overlaps the bunny's feet. The background trees are fixed (see pairs). HUD shows FOX GAP 49 in red, and nothing else in the frame says "you are about to die". |
| summary | yes | n/a | yes | yes | yes | partial | yes | partial | A clean, readable modal: score, distance, carrots, best, and one-tap Play again. The summary line the plan promised ("fox was X m back") is missing and has been replaced by a generic "So close — one more clean dodge." The catch itself is never shown. |

R3 and R7 are "no" at five of the six moments. Under the skill's verdict rule, that alone makes this `not_ready`.

## Pairs against the previous round

Same seed and same inputs. trial-r1f is on the left, trial-final on the right. The only thing the builder fixed since then is the background trees drifting off-screen late in a run (Round 2 response).

| Moment | Better side | Anything worse? |
|---|---|---|
| early | same | No. Pixel-identical as far as I can see. |
| first-reward | same | No art change. Left shows carrots 0 / dist 282 and right shows carrots 1 / dist 298, so the two captures are a few ticks apart even with "identical inputs". This is a harness capture oddity, not a regression. |
| first-damage | same | No. |
| first-danger | same | No. |
| before-end | right | No. This is the real fix. On the left the tree band is gone and the sky is an empty gradient. On the right the trees are back. |
| summary | right (slightly) | No. Trees are faintly visible behind the modal on the right. |

No regressions. One fix is confirmed, and it was a real bug. The fix did nothing about the problems above, all of which are in the trial-r1f frames too.

## Motion (final round, from filmstrip)

The filmstrip is 16 frames about 0.1 s apart, at dist 9095 to 9533, ending at tick 2518, one tick before the catch.

- **Player reads in every frame: yes.** The cream bunny stays at a fixed screen position in the left lane in all 16 frames. It never switches lanes or jumps in this window, so the strip shows no lane-slide or jump-arc motion.
- **Hit (frames 3 to 4):** the bunny turns pink and the screen washes red. FOX GAP drops from 73 to 31 in one frame. The rock it hit is then drawn on top of the fox. It is a clear "something happened", but the rock and the bunny looked laterally offset in frame 3. This is my inference from stills: a player may feel the hitbox is wider than the drawing. Check this in recording.webm.
- **Red wash fade:** it fades over about 4 frames (0.4 s). This is smooth and fine.
- **"CLOSE" label pulses:** bright in frames 5, 6, 8, 9, 12 and 13, near-invisible in 7, 10, 11, 14 and 15, gone in 15 and 16. At the faint phase it cannot be read at all. It vanishes at gap 49, about 0.2 s before the run ends.
- **Pop-in:** none. Obstacles and carrots are born tiny at the horizon and grow smoothly.
- **Smear or ghosting:** none, which agrees with `clears-each-frame` PASS.
- **Off-screen kill:** effectively yes. The last frame shows gap 49 with a rock touching the bunny. The next capture is "The fox caught you." The catch is never shown on camera, neither the fox leap nor any freeze frame. From the player's side, the death arrives without a visible cause. I could not see why gap 49 became 0, because the strip stops one tick short. The owner should watch the end of recording.webm.
- **Fox motion:** it shifts a few pixels between frames and stays the same size and pose. It never animates as running. In 1.6 s of stills it looks like a sliding decal, not a predator.

## Intent match

- Verb: lane-hop and leap exist and the harness confirms they matter (`skill-matters` PASS: humanish p50 42 s vs random 4 s). Neither verb is visible in any of the 22 frames I reviewed, so their feel is unverified.
- Pressure / fail: the numbers say pressure works. The visuals barely carry it. A number in the HUD and a faint pulsing word do most of the work. The fox, the thing that should be the pressure, does not change in a way you can feel.
- Tone / art direction: dusk is there in the colour scheme (indigo and russet) when the screen is not red. Ink outlines are present on the bunny and fox only, and thin. The obstacles have none. "Mean fox" is not delivered. "Cute bunny" is.
- Promised content: lanes, jump, carrots, logs, rocks, roots, fox gap, best score: present. Winding path: missing. Fox leap on catch, larger fox when close, edge vignette, and the "fox was X m back" summary line: all promised in the plan, none visible.
- Verdict: **partial** — "It's a working three-lane dodge game with a fox icon behind you, but it isn't yet the winding, predatory Temple Run chase that was pitched."

## Harness numbers that shaped the verdict

(Quoted from report.md; not re-measured.)

- `run-band` FAIL: "humanish p50 42 s; brief run_band 45–240 s". Treated as WARN on the builder's instruction. It is an owner call whether the bot's 5 % noise is unfair. A typical decent run landing 3 s under the band floor is plausible for a real player too.
- `strong-player-lasts` PASS: "searcher p10 85 s". `has-ceiling` PASS: "7/20 searcher runs hit the time cap". Skill is rewarded, and a top player can run forever. Nothing changes visually as you go (speed only), so long runs are also visually monotonous. That second point is inferred from before-end looking just like early.
- `events:danger` humanish 169.82/min. Danger fires almost three times a second, which suggests the "CLOSE" state is on nearly all the time. That matches the filmstrip: it shows CLOSE in 12 of 16 frames. A warning that is always on stops being a warning. This is inferred from the number plus the filmstrip, not observed in play.
- `draw:below:fox-player` PASS and `draw:hudClear:player` PASS. The harness checks position, not overlap. Fox-over-bunny overlap is visible at three moments even though both checks pass.
- `frame-time` p95 33.4 ms at 4× throttle, `offline` PASS, `console-clean` PASS. The platform side is solid.

## Complaints (ranked)

Feel, art/polish, design, content. Player's voice.

1. **Straight, static road (content/pitch).** "Winding path" is in the pitch's first sentence. With no curves, no turns and no roadside scenery, every second of every run looks the same. Whether the MVP may ship a straight road is an owner call. The pitch as written says it may not.
2. **The fox is not predatory (art/pitch).** It needs to be bigger and closer when the gap is small, and it needs a running or lunging pose, visible eyes or teeth, and an on-screen catch. The current prone silhouette reads as cute, which is the bunny's job.
3. **Sprite overlap and no depth order (R3).** Fox over bunny at early, first-damage, first-danger and before-end. Bunny over rock at before-end. Nothing reads as standing on the ground: there are no contact shadows under the obstacles and only a faint one under the bunny.
4. **Obstacle art is placeholder (R7, R2).** Logs blend into the path, especially under the red wash. The root is a bare triangle. The brief's ink outlines are missing on all obstacles.
5. **Danger feedback is weak and constant.** "CLOSE" is low-contrast, blinks to invisible, and is on most of the time. Three of the five gameplay key moments are washed solid red, so the dusk mood is lost exactly when the chase is hottest. The plan's edge vignette would do better.
6. **Unexplained death.** At gap 49 the warning is off, and then you are caught. The catch is never shown. Players will feel cheated.
7. **Scenery staging.** The tree band sits on a hard horizontal seam. The path's far end is a flat cut with no fog. The flat ground on both sides is empty. Together these make the scene look like a diagram of a forest.
8. **Summary is missing the promised "fox was X m back" line.** Minor, but it is the one "one more go" hook the plan named.

## Not checked

- recording.webm was not watched (the skill does not require it). The catch animation, lane-slide and jump arc are therefore unverified. The owner should watch the last seconds.
- The menu screen. There is no key moment for it. `canvas-drawn:menu` and `layout` PASS are the only evidence.
- Portrait vs landscape vs desktop composition. All key moments are portrait (390 px wide). `layout` PASS covers clipping, not looks.
- Sound. `audio` PASS (peak RMS 0.0124) only shows that there is sound. Whether it is tasteful and "minimal" was not judged.
- Install flow. `offline` PASS only.
- Whether the frame-3 rock was actually in the bunny's lane (hitbox fairness). This was inferred from stills only.

## Builder response

<!-- Builder appends below. Do not edit critic verdicts above. -->

### Round 1
(The round-2 critic pre-filled this section; replaced by the builder.)
- Addressed: fox drawn ahead of the bunny (3c5a31e); bunny hidden behind passed obstacles (762465a); fox gap could not recover below 45 % (9306720); first regular wave stacked on the seeded one (e906743); wave spacing too tight at max speed (e11b4d4); rocks now a hard stumble, so the fox ends every run (fb2a557).
- Not addressed by code: frame-time, layout:desktop and touch-input FAILs in trial-r0/r1a were machine-load flakes (a probes-only re-run at the same commit passed).
- Harness before → after: tools/qa/out/GroveRun/compare/trial-r0__trial-r1f/compare.md
- Left for owner: run-band (humanish p50 42 s vs 45 s). With the bot's 5 % per-decision noise at 10 decisions/s it makes a random move every ~2 s; with noise 0 the same bot's p50 is ~100 s. Left failing, not tuned in expect.json.

### Round 2
- Addressed: background trees drifted off-screen for good after ~distance 1400 (JS negative modulo); seen in trial-r1f before-end.png, not raised by the critic.
- Harness before → after: tools/qa/out/GroveRun/compare/trial-r1f__trial-r2/compare.md (draw only, identical inputs)
- Final run: tools/qa/out/GroveRun/trial-final/
- Left for owner: run-band, as above.

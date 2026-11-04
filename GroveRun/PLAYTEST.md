# Playtest — GroveRun @ trial-final2

Date: 2026-11-04
Tester: game-art-director (fresh agent; no source edits, game not run)
Round: final
Harness run: tools/qa/out/GroveRun/trial-final2/ — 32 checks: 31 PASS, 1 FAIL (`run-band`, humanish p50 42 s vs 45 s). The builder asked for it to be treated as a WARN and sent to the owner, so this review judges everything else. The FAIL is still there.
Compared with: trial-final. `node tools/qa/compare.mjs GroveRun trial-final trial-final2` crashed twice with `Z_BUF_ERROR: unexpected end of file` in `decodePng`, which means one of the PNGs in the two runs is truncated. No `pairs/` were produced, so I compared the two runs' `moments/*.png` and `filmstrip.png` by eye.
Recording (final round): tools/qa/out/GroveRun/trial-final2/recording.webm (30 s of the long bot run, real speed; not watched by this reviewer)

## Pitch (verbatim)

> Temple Run–style endless runner chase. You play as a bunny on a winding path. A fox is always behind you. Switch lanes and jump to dodge obstacles, grab carrots, and survive as long as you can. Dusk woodland mood; ink-outline readable silhouettes; the fox should feel predatory. Mobile-shaped installable PWA.

## Brief

shape=real-time arcade run_band=45 s – 4 min inputs=both orientation=any sound=minimal done_pct=70 %
tone=dusk woodland, ink outlines, cute bunny vs mean fox; readable silhouettes persists=best score non_goals=no multiplayer; no meta unlock tree for MVP; no licensed art

## Polish verdict

**not_ready**

The round-3 work is real and visible. The fox, obstacles and danger label are clearly better, with no regressions. But the build is still not the game that was pitched, and the scenery still looks like a diagram.

Top reasons, player's voice:

1. **"It's still a straight brown triangle, not a winding path."** In every frame the road is the same trapezoid with its far end pinned at one point on the horizon. The bottom of the road sways a few pixels left and right across the filmstrip, but it never bends and nothing goes past it. Both sides are empty flat colour, and the trees are a row of flat triangles standing on a ruler-straight horizon line. "Winding path" is in the pitch's second sentence and in the plan's Look section. The builder has passed this to the owner as a taste and scope call. As written, the pitch is not met.
2. **"The fox is scarier now, but it's running sideways, and I never see it catch me."** The new fox is bigger, has teeth, an eye and a shadow, and now reads as mean. But it is drawn in profile with its snout pointing right, across the path, in every frame. It looks like it is crossing the road rather than coming up behind me. In the stills it holds the same pose through all 16 filmstrip frames. If it gallops, that cannot be seen at 0.1 s spacing. The catch still happens off camera: the last gameplay frame shows FOX GAP 49, and the next screen is a modal. Behind the modal there is a faint shape that might be the fox on the bunny, but you cannot read it.
3. **"The hit flash still eats the dusk, and I can't tell what one rock costs."** At early (t180) and first-damage (t174) the whole screen is still plum and crimson. It is a little less red than last round, but the indigo dusk is gone at the exact moment the chase gets hot. In the filmstrip one hit takes FOX GAP from 73 to 31. The run then ends at 49 when the bunny meets a rock. Nothing on screen tells the player that a rock means death below about 45. "FOX CLOSE!" is on from gap 31 to 49 alike and on at every gameplay moment where the gap is below about 85, so it carries no information about how close death is.

## Rubric by key moment

| Moment | R1 player | R2 danger/reward | R3 grounded | R4 HUD | R5 tone | R6 feedback | R7 finished | R8 pitch | Notes |
|---|---|---|---|---|---|---|---|---|---|
| early (t180) | yes | partial | yes | yes | no | yes | no | partial | The cream bunny is clear, with a hit tint and an orange puff. The logs now read as logs, with grain, cut ends and outlines, though they are small at that distance. The carrot is a thin 8–10 px sliver. The fox sits a clear body-length back with no overlap. The frame is fixed from last round. The whole scene is still washed plum and crimson from the t174 hit. The ground on both sides is empty, and the tree band stands on a hard seam. |
| first-reward (t110) | yes | yes | yes | yes | yes | yes | no | partial | This is the best frame. The indigo dusk reads. The root is now an arched, inked root with a knot instead of a bare triangle. The rock is lit, with an outline and a contact shadow. Carrot particles show on the bunny. Characters and obstacles look finished. The road and surroundings do not: straight trapezoid, flat empty sides, and the far end of the road is a hard cut with no fog. |
| first-damage (t174) | yes | yes | yes | yes | no | yes | no | partial | Feedback is unmistakable. The logs no longer disappear into the path under the wash, which is fixed. The fox is behind the bunny, clear of its feet. The dusk palette is lost to the wash. Same scenery staging as above. |
| first-danger (t256) | yes | yes | yes | yes | partial | yes | no | yes | "FOX CLOSE!" is now bold orange with an ink outline, and it reads as an alarm. Fixed. A red vignette shows at the top and bottom edges. The fox is big, toothed and right behind. This frame shows the chase best. FOX GAP shows 82 in white while the alarm is up, so the HUD and the banner disagree about how serious it is. |
| before-end (t2519) | yes | yes | yes | yes | yes | partial | no | partial | The bunny stands in front of the rock, with correct depth order and contact shadows. The fox is close behind. Gap 41 in red and the alarm say danger. There is no hint that this rock ends the run. The trees are present. |
| summary | yes | n/a | yes | yes | yes | partial | partial | partial | The modal is clean and has one-tap Play again. "FOX CLOSE!" is still drawn on the canvas behind the modal, which is leftover state on the end screen. The plan's "fox was X m back" line is still missing; the line reads "So close — one more clean dodge." The catch behind the modal cannot be read. |

R1 and R3 are "yes" everywhere, which is a real step up from trial-final. R7 is "no" at every gameplay moment. That is no longer because of the sprites. It is because of the scenery: an empty flat field on both sides, triangle trees on a straight seam, and a road that ends in a cut. Under the skill's rule, an R7 "no" anywhere means `not_ready`.

## Pairs against the previous round

compare.mjs crashed (see header), so these are side-by-side reads of `trial-final/moments/*` (left) against `trial-final2/moments/*` (right). The builder said they fixed three things: the fox, the obstacle art, and danger readability (vignette, lighter flash, a label that never fades).

| Moment | Better side | Anything worse? |
|---|---|---|
| early | right | No. On the right the fox is bigger, has teeth and a shadow, and no longer touches the bunny's feet. The logs have outlines and cut ends instead of brown ovals. The "lighter flash" is barely visible: both frames are crimson. |
| first-reward | right | No. On the right the root is an arch instead of a triangle, the rock is lit and outlined, the log has grain, and the fox has more presence. Same HUD numbers on both sides (dist 298, carrots 1). |
| first-damage | right | No. On the right the wash is a little more plum than red, and the logs stay visible under it. |
| first-danger | right | No. The left shows a faint rose "CLOSE" watermark with the fox under the bunny. The right shows an inked orange "FOX CLOSE!" with the fox behind. Note that the two frames are not the same game state: left dist 711 / gap 40, right dist 674 / gap 82. The gap or threshold rules changed this round, so this round was not draw-only. Not a regression, but the pair is not like-for-like. |
| before-end | right | No. Right: gap 41 plus the alarm. Left: gap 49 with nothing. Depth order is the same on both sides: bunny in front of the rock. Again, the two frames are different states (dist 9538 vs 9460). |
| summary | same | No. The final numbers are the same (3715 / 9543 / 15). The right side leaves "FOX CLOSE!" visible behind the modal, which is a small polish loss but not a regression in what the player reads. |

No regressions. Three fixes are confirmed: fox presence, obstacle art, and alarm legibility.

## Motion (final round, from filmstrip)

The filmstrip is 16 frames about 0.1 s apart, dist 9095 to 9533, ending at tick 2518.

- **Player reads in every frame: yes.** The bunny stays in the left lane all 16 frames. It never switches lanes or jumps in this window, so the slide and the jump arc are still unseen in any still I have reviewed across two final rounds.
- **Hit (frames 3 to 4):** the bunny runs into the arched root in its own lane. Then the bunny turns pink, the screen goes red, and FOX GAP drops from 73 to 31. Cause and effect read. This is better than last round, where the offending obstacle looked offset.
- **Wash fade:** the wash fades over about 3 to 4 frames. This is smooth.
- **"FOX CLOSE!":** it is solid from frame 4 to frame 16 and never fades. The fix is confirmed. Its weakness now is the opposite one: it is always on.
- **Fox position:** in frame 4 the fox is a lane to the right of the bunny. By frame 5 it is directly under it, so it moves a lane in 0.1 s or less. That reads as a snap, not a chase (inferred from stills). In frames 5 to 8 (gap 31) the fox's ear tips touch the bunny's feet, so the "body-length back" spacing collapses when the gap is low. In frames 13 to 16 (gap 40 to 49) they are clearly apart.
- **Fox pose:** I cannot see any gallop cycle at this scale. The silhouette, a sideways profile with the snout to the right, looks the same in all 16 frames. The owner should check this in recording.webm.
- **Duplicate frames:** frames 2 and 3, 6 and 7, 8 and 9, and 12 and 13 show identical dist and score, four repeats. trial-final had two. This is either capture cadence or a sim hitch. I cannot tell which from stills. `frame-time` PASS says p95 is 33.4 ms, so it is probably capture, but the owner should check for stutter in the recording.
- **Pop-in / smear:** none. Obstacles grow smoothly from the horizon, which agrees with `clears-each-frame` PASS.
- **Off-screen kill:** partly fixed. In frame 16 the rock is visibly in the bunny's lane at its feet, so the cause of death is now on screen. The catch itself is not: the strip ends at gap 49 and the next image is the modal.

## Intent match

- Verb: the harness shows lane-hop and leap matter (`skill-matters` humanish p50 42 s vs random 4 s). No frame shows either verb in motion, so their feel is unverified.
- Pressure / fail: the fox now looks like a threat, and the alarm is legible. Because the alarm is on at nearly every moment, and one rock can end a run from gap 49, a player gets no warning before the hit that kills them.
- Tone / art direction: the cute bunny is delivered. The mean fox is mostly delivered; it is let down by the sideways pose. Ink outlines are now on the bunny, fox, logs, root and rock. Dusk indigo shows when the screen is not tinted. The woodland is a strip of flat triangles over empty ground, which is a backdrop rather than a place.
- Promised content: lanes, jump, carrots, logs, rocks, roots, fox gap, vignette, larger fox when close, and best score are all present. Still missing: the winding path, the fox leap or catch on screen, and the "fox was X m back" summary line.
- Verdict: **partial** — "The characters are finished and the fox finally looks hungry, but the world is a straight ramp through an empty field, and the chase never pays off on camera."

## Harness numbers that shaped the verdict

(Quoted from report.md; not re-measured.)

- `run-band` FAIL: "humanish p50 42 s; brief run_band 45–240 s". Treated as WARN on instruction. It is an owner call, per the builder's noise argument in Round 1.
- `events:danger` humanish "169.82/min, 124/run". The danger state is effectively always on, which matches the always-lit "FOX CLOSE!" in 13 of 16 filmstrip frames. The alarm is legible, but at that rate it does not tell the player anything new.
- `strong-player-lasts` searcher p10 85 s and `has-ceiling` 7/20 capped. Long runs exist. Before-end (dist 9460) looks the same as first-reward (dist 298) apart from the HUD. Over a 4-minute run nothing visual changes, which is inferred from those two frames.
- `draw:below:fox-player`, `draw:hudClear:player`, `draw:minSize:player` PASS. These agree with what I see in the key stills. They do not catch the ear-on-feet touching at gap 31 in the filmstrip.
- `frame-time` p95 33.4 ms at 4× throttle, plus `offline`, `layout` and `console-clean` PASS. The platform side is solid.

## Complaints (ranked)

Feel, art/polish, design, content. Player's voice.

1. **Straight road, empty world (pitch, R7).** It needs a road that visibly bends, or at least curves with the horizon shifting, plus things going past beside it: trunks, ferns, stumps, fireflies. The flat field and the triangle trees on a seam are what make every frame look unfinished. If the owner rules that a straight MVP road is fine, the roadside scenery is still needed for R7.
2. **No on-screen catch (feel).** The run ends on a modal. A half-second of the fox lunging and the frame freezing before the summary would pay off the whole chase. This was promised in the plan's feedback table ("fox leap").
3. **The fox faces across the path (art).** A chaser seen from behind the runner should point up the screen toward the bunny: a three-quarter view, or head-on with the jaws toward the camera. The sideways profile undercuts "behind you".
4. **Hit wash still kills the dusk (tone).** Early and first-damage are wholly plum or crimson. Keep the red to the edges, as the new vignette does, and leave the centre indigo.
5. **Danger has one level (design).** The same "FOX CLOSE!" shows at gap 82 and at gap 31, while one rock can end the run from 49. The alarm and vignette should get stronger as the gap gets smaller, or the HUD should show the gap as a bar with a "one more hit" mark.
6. **Fox snaps a lane at a time and touches the bunny at low gap (motion).** Seen in filmstrip frames 4 to 8.
7. **Carrots are tiny.** An 8–10 px sliver, even close to the bunny. This is the reward you are told to grab, and it is the smallest thing on screen.
8. **Summary:** "FOX CLOSE!" is still drawn behind the modal, and the promised "fox was X m back" line is missing.

## Not checked

- recording.webm was not watched. Still unverified: the gallop cycle, lane-slide, jump arc, the catch behind the modal, and whether the duplicate filmstrip frames are stutter.
- Pairs were not produced, because compare.mjs crashed on a truncated PNG in trial-final or trial-final2. I did not find out which file. The pair verdicts above are by eye from the moments folders.
- Before-end (tick 2519, dist 9460, gap 41) does not line up with the filmstrip's end (tick 2518, dist 9533, gap 49). This is a harness capture oddity and was not investigated.
- The menu screen, desktop and landscape composition, sound taste, and the install flow. Only PASS checks are evidence for these.

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

### Round 3
- Addressed (art director, trial-final): fox now larger with threat, galloping, teeth, shadow, a body-length back (f9d51fa); obstacle art with contact shadows, log grain and cut end, arched root, lit rock (a31e0aa); edge-only threat vignette, lighter hit flash, inked "FOX CLOSE!" that never fades out (this commit's parent).
- Harness before → after: tools/qa/out/GroveRun/compare/trial-final__trial-r3a/, trial-r3a__trial-r3b/, trial-r3b__trial-r3c/ (draw only, identical inputs)
- Left for owner: straight vs winding path (pitch says winding; a taste and scope call); no on-screen catch animation; summary lacks the plan's "fox was X m back" line; run-band, as above.


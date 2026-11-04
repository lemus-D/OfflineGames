# Playtest — GroveRun @ trial-r0

Date: 2026-11-04
Tester: game-critic (fresh agent; no source edits)
Round: 1
Harness run: tools/qa/out/GroveRun/trial-r0/ — 5 checks failing
Compared with: none
Recording (final round): (not a final round)

## Pitch (verbatim)

> Temple Run–style endless runner chase. You play as a bunny on a winding path. A fox is always behind you. Switch lanes and jump to dodge obstacles, grab carrots, and survive as long as you can. Dusk woodland mood; ink-outline readable silhouettes; the fox should feel predatory. Mobile-shaped installable PWA.

## Brief

shape=real-time arcade run_band=45s–4min inputs=both orientation=any sound=minimal done_pct=70% tone=dusk woodland, ink outlines, cute bunny vs mean fox; readable silhouettes persists=best score non_goals=no multiplayer; no meta unlock tree for MVP; no licensed art

## Polish verdict

**blocked: harness checks failing**

### Failing checks (builder must fix first)

1. **run-band** — humanish p50 17 s; brief run_band 45–240 s. A decent player's typical run should land inside the brief's run length.
2. **strong-player-lasts** — searcher p10 31 s; band starts at 45 s. If even the best bot dies early, deaths are unavoidable rather than skill-based.
3. **frame-time** — p50 83.3 ms, p95 100 ms, 86% frames > 50 ms at 4× CPU throttle (limit p95 50 ms). Jank under a slow phone CPU is what players feel as lag.
4. **layout:desktop** — probe could not finish: page.waitForFunction: Timeout 5000ms exceeded. Layout pass at this viewport.
5. **draw:below:fox-player** — first-reward, early, first-danger, before-end: fox is not below player in any key moment. Pitch: the fox chases from behind. With the camera behind the bunny, behind means lower on screen.

This playtest is not complete until these checks pass. The harness numbers are facts; art and feel feedback will wait for the next round.

## Builder response

<!-- Builder appends below. Do not edit critic verdicts above. -->

### Round 1
- Addressed:
- Harness before → after: tools/qa/out/GroveRun/compare/<before>__<after>/compare.md
- Commits:
- Left for owner:

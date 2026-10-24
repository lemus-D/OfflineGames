# Playtest — GroveRun @ a1ec20b

Date: 2026-10-24
Tester: parent polish critic (builder subagent spawn failed on usage limits; parent is not the GroveRun author)
Server: http://localhost:5184
Recording: `/opt/cursor/artifacts/groverun-playtest-recording.mp4`
Motion + art review: done — screenshots under `/opt/cursor/artifacts/screenshots/groverun-*.png`

## Pitch (verbatim)

> Temple Run–style endless runner chase. You play as a bunny on a winding path. A fox is always behind you. Switch lanes and jump to dodge obstacles, grab carrots, and survive as long as you can. Dusk woodland mood; ink-outline readable silhouettes; the fox should feel predatory. Mobile-shaped installable PWA.

## Brief

shape=real-time arcade run_band=45 s – 4 min inputs=both orientation=any sound=minimal done_pct=70 %
tone=dusk woodland, ink outlines, cute bunny vs mean fox; readable silhouettes
persists=best score
non_goals=no multiplayer; no meta unlock tree for MVP; no licensed art

## Polish verdict (primary)

**not_ready**

Why:
- Mid-run captures repeatedly showed a nearly empty playfield (flat dusk wash + HUD only). Bunny, fox, path, obstacles, and carrots were not reliably readable in the frames captured for review — unacceptable for a chase game whose pitch promises silhouettes and woodland path.
- Across multiple short runs carrots stayed at **0** while distance hit ~290 — first-reward promise in the plan is missed; the carrot fantasy from the pitch is invisible.
- Fox gap stayed ~154 on rock deaths ("Fox was still 154 back") — the chase does not read as pressure; the fox is not predatory on screen or in the numbers.
- Summary / menu chrome looks intentional (dusk palette, orange CTA, near-miss line). That part is fine; the **play view** is what fails the minimum bar.

## Intent match

- Verb: lane + jump — controls respond; loop exists.
- Pressure / fail: rocks end runs quickly; fox pressure / presence weak vs pitch.
- Tone / art direction: menu/summary match dusk ink mood; in-run readability failed in review captures.
- Inputs / sound vs brief: keyboard works; touch/sound not fully verified this pass (see Not checked).
- Promised content: carrots effectively absent in observed runs; fox "always behind you" not felt.
- Verdict: **partial / miss** — "I got a lane runner that dies to rocks, not a bunny–fox dusk chase."

## Playability sanity

(Mechanical console suite: 0 errors observed this session across load/play/end.)

- [x] loop closes without reload — Play → die → Play again (evidence: summary UI, button works)
- [x] required inputs work (keyboard) — ArrowLeft/Right/Up/Space
- [ ] required inputs work (touch) — not checked this pass
- [x] fit / orientation (desktop viewport) — HUD/summary readable; touch layout not checked
- [x] persistence — Best showed 102 after first run and remained
- [ ] offline after server kill — not checked this pass
- [x] recording + art/motion review — path above

Playability: **FAIL** (missing touch + offline checks; carrot/fox fantasy broken enough to fail owner handoff)

## Complaints (ranked)

1. "I can't clearly see the bunny, fox, or path while playing — just a dark field and numbers."
2. "I never got a carrot in whole runs — what am I collecting?"
3. "The fox was still 154 back when I died — I don't feel chased."
4. "I die to rocks before the run has a shape; first minute feels like a slap, not a chase."
5. "Summary is pretty but it advertises a game the play view didn't show me."

## Gate 2 — Fun

(8/20 = 40 %, threshold 70 %; N/A: none)

F1 verb: 1 — "Lane/jump respond, but the picture doesn't teach the chase fantasy."
F2 readable: 0 — "Playfield not readable in review captures; fox/carrot state HUD-only."
F3 feedback: 1 — "Death message + summary exist; collect feedback unseen (0 carrots)."
F4 fair deaths: 1 — "Rock deaths named; still felt abrupt before carrots/fox mattered."
F5 tension: 0 — "Fox gap flat; no climb into danger; runs end short without carrot rewards."
F6 one more go: 2 — "Play again one click; near-miss line + best persisted."
F7 controls: 1 — "Keyboard fine; touch not verified; thumb layout unknown."
F8 look: 0 — "Menu/summary OK; in-run art failed the readable-silhouette bar."
F9 sound: 0 — "Not confirmed hearing action/reward/fail this pass (treat as unmet minimal)."
F10 depth: 1 — "Log/rock/root dodge types exist in data; not felt as distinct play."

## Art / motion findings (from recording + screenshots)

- Summary panel: clean, on-brand dusk/orange — keep.
- Live chase frames: insufficient silhouette clarity for bunny/fox/path; fails pitch tone.
- Motion: deaths flip to overlay quickly; little sense of fox closing in camera or gap.
- Recording: `/opt/cursor/artifacts/groverun-playtest-recording.mp4`

## Not checked

- Touch @ 390×844
- Offline after server kill
- Full videoReview subagent (usage limits blocked spawn; parent reviewed recording/screenshots instead)
- 4× CPU throttle

## Builder response

<!-- Orchestrator / builder appends below. Do not edit critic scores above. -->

# Critic spawn request (builder cannot spawn)

The builder agent is a **subagent** without a Task / computerUse spawn tool.
Per `game-qc` Step 2: do not run `game-playtest` in the builder context.

**Parent / owner:** please spawn a fresh polish critic with this prompt:

---

You are the polish critic for GroveRun. Follow
`.cursor/skills/game-playtest/SKILL.md`.

Your job is a minimum quality bar: art style, finish, no half-baked /
floating / prototype look — so the owner only reviews near-final builds.
Do NOT focus on console errors (already checked). Do NOT edit game source.

Original pitch:
"""
Temple Run–style endless runner chase. You play as a bunny on a winding path. A fox is always behind you. Switch lanes and jump to dodge obstacles, grab carrots, and survive as long as you can. Dusk woodland mood; ink-outline readable silhouettes; the fox should feel predatory. Mobile-shaped installable PWA.
"""

QC brief:
"""
shape: real-time arcade [owner]
run_band: 45 s – 4 min [owner]
inputs: both [owner]
orientation: any [owner]
sound: minimal [owner]
done_pct: 70 % [owner]
tone: dusk woodland, ink outlines, cute bunny vs mean fox; readable silhouettes [owner]
persists: best score [owner]
non_goals: no multiplayer; no meta unlock tree for MVP; no licensed art [owner]
"""

Mechanical suite: PASSED (gate 0 + browser checks).
Build: GroveRun/ at http://localhost:5184 (sha will be on the PR branch tip).
Write GroveRun/PLAYTEST.md. Record + videoReview. Be critical.
Polish verdict must be ready_for_owner or not_ready.

# Break — MVP plan

Top-down pool. Single-player “clear the rack”: pocket all fifteen object balls
in as few shots as possible. Installable PWA, Canvas 2D, zero asset files.

## Loop

1. Rack opens with a seeded triangle and the cue in the kitchen.
2. Drag back from the cue ball to aim; release to shoot.
3. Physics runs on a fixed timestep until everything stops.
4. Scratch → ball in hand in the kitchen; tap to place, then aim again.
5. Clear all fifteen → local best (fewest shots) saved under `break.v1.profile`.

## Non-goals for MVP

- Full 8-ball / 9-ball rules and two-player turns
- Spin / English
- AI opponent
- Online leaderboard

## Stack (repo standards)

- No build step, plain ES modules, zero-dependency `server.js`
- All art procedural (felt, rails, balls, cue)
- No `Math.random()` in game logic — seeded rack jitter only
- Simulation fixed-timestep, separate from render

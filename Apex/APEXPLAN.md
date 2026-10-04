# Apex — design notes (MVP)

Endless rocket ascent. Hold boost to climb, scoop gas cans, bank coins, and
dodge meteors that punch holes in your tanks.

## Loop

1. Hold **↑ / W** to boost. Release and gravity pulls you down.
2. Steer left / right (← → or A / D).
3. Fuel burns only while boosting; grab **gas cans** to top up.
4. **Coins** add score.
5. **Meteors** drain fuel on contact.
6. Hit the ground after liftoff → run over. Score from peak altitude + coins.

## Controls (MVP)

- Keyboard: boost + left / right.
- On-screen buttons and pointer steer come later.
- Art is procedural 8-bit (pixel sprites, flat palette).

## Technical

Same house rules as the rest of the repo: no build step, no asset files, seeded
RNG, fixed timestep, namespaced saves (`apex.v1.profile`), installable PWA.

```bash
cd Apex && npm start   # http://localhost:5182
cd Apex && npm run smoke
```

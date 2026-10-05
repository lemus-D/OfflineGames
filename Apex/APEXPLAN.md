# Apex — design notes (MVP)

Endless rocket ascent. Hold boost to climb through Earth's atmosphere, scoop
gas cans, bank coins, and dodge meteors. Long runs can fly by the Moon and Mars.

## Loop

1. Hold **↑ / W** to boost. Release and gravity pulls you down.
2. Spin left / right (← → or A / D) — full 360°.
3. Fuel burns only while boosting; grab **gas cans** to top up (even while falling).
4. **Coins** add score.
5. **Meteors** drain fuel on contact.
6. Hit the ground after liftoff → run over.
7. Sky color follows real layers (troposphere → exosphere). Easter eggs: **Moon**
   (~384,400 km) and **Mars** (closest approach ~54.6M km), on a compressed
   deep-space scale so they're ambitious but reachable.

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

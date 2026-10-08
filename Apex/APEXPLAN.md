# Apex — design notes (MVP)

Endless rocket ascent. Hold boost to climb through Earth's atmosphere, scoop
gas cans, bank coins, and dodge asteroids. The map wraps side-to-side so you can
strafe forever. Long runs fly by scaled solar-system bodies — Moon through Pluto.

## Loop

1. Hold **↑ / W** to boost. Release and gravity pulls you down.
2. Spin left / right (← → or A / D) — full 360°. Fly off either side; the sky
   wraps, so the map is infinite horizontally.
3. Fuel burns only while boosting; grab **gas cans** to top up (even while falling).
4. **Coins** add score.
5. **Asteroids / meteors** chip **hull** integrity (and a little fuel). Hull at
   0 ends the run. Hull Plating upgrades cut the damage.
6. **Black holes** (higher altitude) pull you in. Cross the event horizon → run over.
7. Hit the ground after liftoff → run over.
8. Sky color follows real layers (troposphere → exosphere). Easter eggs: **Moon**
   through **Pluto** on a compressed deep-space scale. Bodies draw at relative
   real-radius scale (Sun much larger than Jupiter, much larger than the Moon).

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

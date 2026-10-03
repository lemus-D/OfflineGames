# Apex — design notes (MVP)

Endless rocket ascent. Stay aloft by scooping fuel pockets, bank coins, and
dodge meteors that punch holes in your tanks.

## Loop

1. Rocket climbs automatically.
2. Steer left / right with the keyboard (← → or A / D).
3. Fuel burns continuously; hit **fuel** orbs to top up.
4. **Coins** add score.
5. **Meteors** drain fuel on contact.
6. Fuel hits zero → run over. Score from altitude + coins.

## Controls (MVP)

- Keyboard only: left / right.
- On-screen buttons and pointer steer come later.

## Technical

Same house rules as the rest of the repo: no build step, no asset files, seeded
RNG, fixed timestep, namespaced saves (`apex.v1.profile`), installable PWA.

```bash
cd Apex && npm start   # http://localhost:5182
cd Apex && npm run smoke
```

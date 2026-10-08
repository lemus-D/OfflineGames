# Rabbit Run — design notes (MVP)

Temple Run–style endless chase. You are a rabbit; a fox is always behind you.
Dodge obstacles, grab carrots, survive as long as you can.

## Loop

1. Auto-run down a three-lane trail (2.5D perspective on Canvas 2D).
2. **← → / A D** change lanes. **Space / ↑** jump.
3. Hit a **log** or **rock** without jumping → fox closes the gap.
4. **Hedges** are tall — you must switch lanes.
5. **Carrots** score points and buy a little lead on the fox.
6. Fox catches you when the gap collapses → run over.

## Controls (MVP)

- Keyboard: lane + jump.
- On-screen buttons + swipe (left/right/up) on touch.

## Technical

Same house rules as the rest of the repo: no build step, no asset files, seeded
RNG, fixed timestep, namespaced saves (`rabbit.v1.profile`), installable PWA.

```bash
cd RabbitRun && npm start   # http://localhost:5183
cd RabbitRun && npm run smoke
```

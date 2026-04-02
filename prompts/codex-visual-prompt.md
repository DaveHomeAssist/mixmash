# Codex Prompt — BrawlForge Visual Iteration

Copy-paste this into OpenAI Codex when you want to iterate on BrawlForge's visuals.

---

## Prompt

You are editing a single-file HTML5 Canvas fighting game at `index.html` in this repo. The game is called BrawlForge — a Smash Bros-style 2P fighting game rendered entirely with Canvas 2D API (no images, no external assets, everything procedural).

The file is ~2000 lines. Here's the rendering architecture:

### Key rendering functions:
- `renderParallaxBG(stage)` — draws layered backgrounds. Stages have `bgLayers: [{ parallax, shapes, color }]`. Shape types: `stars` (twinkling + shooting stars), `nebula` (radial gradients), `planet` (sphere with atmosphere), `energyparticles` (floating wisps), `castle` (silhouette with towers), `embers` (rising fire particles), `torchglow` (warm gradient from below), `mountains` (sine-wave peaks with snow caps), `sunset` (warm gradient sky + sun), `clouds` (multi-circle puffs), `sunrays` (rotating beams), `birds` (V-shapes).
- `renderPlatforms()` — themed platforms. `currentStage.theme` is `arena` (stone with cracks/moss), `cosmic` (crystal with glowing teal edges), or `sky` (wooden planks with supports).
- `drawKnight(ctx, p, w, h, z, color, outline, bodyColor)` — Knight: helmet with visor, armored torso, sword, boots, articulated legs/arms.
- `drawStriker(ctx, p, w, h, z, color, outline, bodyColor)` — Striker: headband with tails, wrapped fists (glow on hit), athletic body, sneakers.
- `renderCharSelect()` — split-screen picker with large character previews, VS spark, stat bars, speed lines.
- `renderStageSelect()` — stage cards with live background previews, pulsing selection border.
- `STAGES` — 3 stages: `battlefield` (arena), `finalDest` (cosmic), `skybridge` (sky).
- `FIGHTER_DEFS` — 2 fighters: `knight`, `striker`. Each has `color`, `outlineColor`, `altColor`, `altOutline`, `w`, `h`, `weight`, `walkSpeed`, `runSpeed`, `jumpForce`, `attacks`, `grab`, `throws`, `desc`.

### Key variables for animation:
- `state.frameCount` — frame counter, use for `Math.sin(state.frameCount * speed)` animations
- `state.camera.zoom` — scale factor `z`, multiply all sizes by this
- `p.facing` — 1 or -1, character direction
- `p.state` — `idle`, `walk`, `jump`, `fall`, `attack`, `hitstun`, `shield`, `dodge`, `grab`, etc.
- `p.attackFrame` — current frame within attack animation

### Constraints:
- Canvas 2D API only — no WebGL, no images, no SVG
- Single file — all code stays in index.html
- Keep `window.render_game_to_text()` and `window.advanceTime(ms)` working
- Use deterministic rendering based on frameCount (no `Date.now()` or `Math.random()` in render — use seeded patterns)

### Task:
[DESCRIBE YOUR VISUAL CHANGE HERE]

Examples:
- "Add a new parallax layer shape type called 'lightning' that occasionally flashes bright bolts across the sky"
- "Redesign the Knight to have a cape that waves behind them using sine-wave cloth simulation"
- "Create a new stage 'underwater' with bubble particles rising, wavering light caustics, and kelp swaying in the background"
- "Add impact frames — when a heavy hit lands, briefly invert colors and flash white for 2 frames"
- "Make the results screen more dramatic with slow-zooming camera on the winner and radial light burst"
- "Add footstep dust clouds that match the stage theme (stone chips for arena, energy sparks for cosmic, leaves for sky)"

When adding a new stage, follow this template:
```javascript
newStage: {
  name: 'Stage Name',
  platforms: [
    { x: -250, y: 200, w: 500, h: 30, type: 'solid' },
    // Add passthrough/moving platforms as needed
  ],
  spawns: [{ x: -100, y: 100 }, { x: 100, y: 100 }],
  bg: '#hexcolor',  // base background fill
  theme: 'mytheme', // add matching case in renderPlatforms()
  bgLayers: [
    { parallax: 0.05, shapes: 'existingType' },
    { parallax: 0.1, shapes: 'newType', color: '#hex' },
  ],
}
```

When adding a new fighter, follow this template:
```javascript
newFighter: {
  name: 'Name', color: '#hex', outlineColor: '#hex',
  altColor: '#hex', altOutline: '#hex',
  w: 36, h: 52, weight: 1.0,
  walkSpeed: 300, runSpeed: 450,
  jumpForce: -600, doubleJumpForce: -520,
  attacks: { neutral: {...}, forward: {...}, up: {...}, down: {...}, aerial: {...} },
  grab: { startup: 6, active: 2, endlag: 25, range: 45, pummelDamage: 2 },
  throws: { forward: {...}, back: {...}, up: {...}, down: {...} },
  desc: 'Short description',
}
```
Then add a `drawNewFighter(ctx, p, w, h, z, color, outline, bodyColor)` function and wire it into `renderPlayer()` and `renderCharSelect()`.

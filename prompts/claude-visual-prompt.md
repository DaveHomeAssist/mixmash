# Claude Code Prompt — BrawlForge Visual Iteration

Copy-paste this into Claude Code when you want to iterate on BrawlForge's visuals.

---

## Prompt

I'm working on BrawlForge, a Smash Bros-style fighting game at `/Users/daverobertson/Desktop/Code/brawlforge/index.html`. It's a single-file HTML5 Canvas game (~2000 lines) with 2D Canvas API rendering (no external assets — everything is drawn procedurally).

### Architecture you need to know:
- **`renderParallaxBG(stage)`** draws background layers. Each stage has a `bgLayers` array with `{ parallax, shapes, color }` entries. Available shape types: `stars`, `nebula`, `planet`, `energyparticles`, `castle`, `embers`, `torchglow`, `mountains`, `sunset`, `clouds`, `sunrays`, `birds`. Add new shape types here.
- **`renderPlatforms()`** draws platforms with per-stage themes using `currentStage.theme` (`arena`, `cosmic`, `sky`). Add new themes here.
- **`drawKnight(ctx, p, w, h, z, color, outline, bodyColor)`** draws the Knight character with helmet, armor, sword, articulated limbs.
- **`drawStriker(ctx, p, w, h, z, color, outline, bodyColor)`** draws the Striker with headband, wrapped fists, athletic build.
- **`renderCharSelect()`** draws the character select screen (split-screen with VS spark, large character previews, stat bars).
- **`renderStageSelect()`** draws stage select with live background previews.
- **`renderTitle()`** draws the title screen.
- **`STAGES`** object has 3 stages: `battlefield` (theme: arena), `finalDest` (theme: cosmic), `skybridge` (theme: sky).
- **`FIGHTER_DEFS`** has 2 fighters: `knight` and `striker`.

### What I want you to do:
[DESCRIBE YOUR VISUAL CHANGE HERE — examples below]

#### Example requests:
- "Add a new background layer type 'waterfall' that draws cascading water on the left side of the arena stage"
- "Make the Knight's sword glow during active attack frames with a trailing afterimage"
- "Add a new stage called 'volcano' with lava bubbles, ash particles, and cracked obsidian platforms"
- "Improve the title screen with an animated logo that pulses and background particles"
- "Add a third fighter called 'Mage' with a robe, staff, and magical particle effects"
- "Make platforms cast shadows beneath them that scale with camera zoom"
- "Add screen-space bloom/glow effect around hitbox areas during attacks"

### Rules:
1. Everything must be procedural Canvas 2D drawing — no external images or assets
2. Keep the single-file architecture (all code in index.html)
3. Maintain `window.render_game_to_text` and `window.advanceTime` for Playwright testing
4. Use the develop-web-game skill workflow: implement, test with Playwright, inspect screenshots, fix, repeat
5. Parallax layers use `state.camera.x` offset — multiply by `layer.parallax` for depth
6. Characters are drawn at a local coordinate origin (0,0 = center of character) — use `ctx.save/restore`
7. Frame counter is `state.frameCount` — use it for animations (`Math.sin(state.frameCount * speed)`)
8. Camera zoom is `state.camera.zoom` — scale everything by `z` parameter

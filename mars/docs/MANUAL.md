# MarsScape — Colonist's Manual

One astronaut, one basin, ten skills, levels 1–99 on the real RuneScape XP curve.
Gather, smelt, craft, build, survive the Great Storm.

This is the player-facing manual. For the engine's authority model see `mars/README.md`;
for balance numbers see `mars/docs/BALANCE_BASELINE.md`.

## 1. The first five minutes

Click a **North Iron Seam** and keep clicking. Every gather trains Mining and fills your
pack. Once you have a few Iron Ore, open **Forge → Smelt Iron Bar**, then craft **Frames**.
Frames plus bars build everything else.

Follow the objective line above the log — it walks you through all 14 steps of the arc,
from your first five iron ore to enduring the Great Storm.

## 2. Survival — the melody underneath

Oxygen and Power drain every tick and never stop. Structures generate; the drain is the
baseline you build against.

- **Habitat** and **Greenhouse** make oxygen. **Solar Array** and **Fusion Reactor** make power.
- **Ration** food to top up oxygen in a hurry. Better crops restore more.
- **Service** a structure to bump both meters and clear any fault.
- At **Survival 25** low-oxygen drain halves. At **40** storm surges soften. At **50** an
  emergency beacon fires automatically once per sol when a meter bottoms out.

Everything is authoritative on the server. The client sends commands; it never sends totals.

## 3. The pack and the Depot

Your pack holds **28 slots** by default. Items stack (most at 24), and a stack takes one
slot — so a full pack blocks gathering. Backpack gear and the **Cargo Frame** research add
slots.

Build the **Colony Depot** early. It is the bank: unlimited storage, `Deposit all` in one
click, and drones deliver straight into it. Loot from treks and harvests routes to the
Depot when it exists, so a full pack never wedges you.

## 4. Skills

Ten skills, all on the RuneScape curve — 99 costs **13,034,431 xp**.

| Skill | Trained by |
|---|---|
| Mining | Ore veins |
| Water Extraction | Ice, permafrost, brine |
| Fabrication | Smelting and crafting |
| Engineering | Building, upgrading, servicing |
| Agriculture | Planting, treating, harvesting |
| Research | Completing projects |
| Piloting | Driving between regions |
| Survival | Rationing, sols, enduring |
| Robotics | Drones — unlocks after the Great Storm |
| Exploration | Treks — unlocks after the Great Storm |

**Quality strikes** double a gather's yield *and* its xp. The chance grows the further you
are above a node's level gate, so levelling past a tier keeps paying — it does not just
unlock the next node and flatten out.

## 5. The ore and ice ladders

| Level | Ore | | Level | Ice |
|---:|---|---|---:|---|
| 1 | Iron | | 1 | Ice Deposit |
| 10 | Copper | | 20 | Permafrost Bed |
| 25 | Titanium (needs Machine Shop) | | 40 | Brine Well |
| 30 | Silicate — glass | | | |
| 55 | Rare-earth — alloy | | | |
| 75 | Iridium (needs Iridium Refining) | | | |

Scanners turn up **geodes** while mining. Geodes are the research-tree currency — tier 2
and 3 projects want them.

## 6. The Forge

**Smelt** ore into bars, glass, alloy and iridium. **Craft** frames, components,
insulation, fertilizer, pickaxes, rovers, fuel cells, drones and all 24 equipment pieces.

Pickaxes cut gather time: Stone → Steel → Titanium → Laser. Crafting a same-or-worse tier
is blocked, so you cannot downgrade yourself by accident.

## 7. Equipment — 6 slots x 4 tiers

Suit and Helmet give **O2 efficiency**, Gloves **quality chance**, Boots **travel speed**,
Scanner **geode find**, Backpack **pack slots**. Tiers run Canvas → Steel → Titan →
Composite; Composite needs the **Alloy Tempering** research.

## 8. Buildings, tiers and overclock

Eight structures. Five upgrade through tiers **I → II → III**, gated on Engineering and
paid in glass, composite frames, alloy and advanced components.

**Overclock** (Engineering 25) raises every structure's output by 35% — but online systems
can trip a **fault** and go offline until serviced. **Automation Core** halves the fault
rate. Watch the Build tab: a faulted structure contributes nothing.

## 9. Farming

The Greenhouse opens **3 plots** (a fourth at Greenhouse III). Five crops:

| Crop | Agriculture | Ticks | Restores |
|---|---:|---:|---:|
| Potato | 1 | 14 | 6 |
| Soy | 15 | 22 | 8 |
| Algae Vat | 30 | 30 | 9 |
| Hydro Berries | 45 | 40 | 11 |
| Genefruit | 60 | 55 | 15 |

**Blight** can strike once per crop, at the halfway point. It pauses growth — it never
kills the crop. Treat the plot with water and growth resumes. **Fertilizer** cuts the
cycle by a quarter; **Grow Lights** by a fifth.

## 10. Research — 20 projects, 3 tiers

Tier 2 opens once you finish **3** tier-1 projects; tier 3 the same from tier 2. Projects
are permanent and their effects are real: faster respawns and crops, more pack slots and
geodes, safer overclock, stronger beacon, +3% xp to everything, and the recipe unlocks for
the Laser Pick, Fertilizer, Iridium, Genefruit and Composite gear.

## 11. Beyond the basin

Refine **Fuel Cells** from water, then drive to the **Dune Sea**: double-yield iron scree
and silicate dunes, plus wreck sites for components. There are no structures out there —
gather away, process at home.

Rovers (**Mk2**, **Mk3**) and Piloting level both cut travel time, and Boots stack on top.

## 12. The Great Storm, and after

Build all eight structures and the storm goes live. It runs **250 ticks in 10 phases**.
Hold oxygen and power above **50%** the whole way. Surges hit periodically; Survival 40
softens them. Fall below 50% and the colony bunkers down — you keep everything and can
try again.

Endure it and **New Expedition+** opens: **Robotics** and **Exploration** unlock, you can
build **drones** to work veins into the Depot, and expedition treks can turn up permanent
**rich veins**.

## 13. Saves

The authority owns your colony. When the server is unreachable the client keeps a signed
local fallback and replays queued commands on reconnect.

Bringing a colony over from the standalone MarsScape? Use the legacy importer: it previews
the conversion before committing, reports anything it could not map instead of dropping
it, and keeps your original save for rollback.

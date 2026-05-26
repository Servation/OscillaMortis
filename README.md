# OscillaMortis

An action-packed, web-based 2D survival shooter/slasher game built with **TypeScript**, **Vite**, and **HTML5 Canvas**. Fend off escalating waves of unique zombie swarms, adapt to changing environmental biomes, purchase weapons or spell tomes from the shop, and level up to survive!

---

## 🎮 Key Gameplay Features

*   **ESCORT & INVASION WAVES**: Battle through endless waves of the undead, scaling in difficulty and introducing new enemy swarms.
*   **DYNAMIC BIOMES & LIGHTING**: Play across four organic biomes:
    *   *Grasslands*: Lush forests with cricket chirps and foliage decals.
    *   *Desert*: Hot sands with wind sweeps, rocks, and tumbleweeds.
    *   *Tundra*: Frozen snowdrifts with ice blocks, pines, and shimmer highlights.
    *   *Lava Fields*: Dark volcanic fields with magma paths and pulsing ambient glow animations.
*   **ENEMY SWARMS & AI TYPOLOGIES**:
    *   `Slimes`: Bouncy slimes that split into minislimes upon death.
    *   `Walkers`: Classic slow-moving shamblers.
    *   `Runners`: Feral, reddish sprinters that chase you relentlessly.
    *   `Ghosts`: Wall-phasing spectral entities with motion trails and eerie glow templates.
    *   `Skeletons`: 4-directional ranged attackers that orbit and shoot bone projectiles.
    *   `Brutes`: Tanky brutes that prepare and execute high-speed charging dashes.
*   **SHOPPING & ECONOMY**: Proximity-based entry to the shop during Wave Prep. Interact with stands to purchase:
    *   *Weapons*: Swords, Club, Baseball Bat, Machete, and Fire Axe.
    *   *Consumables*: Health Elixirs, Energy Tonics, Swiftness Draughts, Ironskin Brews.
    *   *Magic*: Tomes to expand your spell inventory.
*   **SPELL CASTING & MAGIC SYSTEM**: Use your number keys `1`-`4` to cast powerful spells:
    1.  **Tome of Wrath (AOE)**: Triggers a massive kinetic shockwave, blasting away surrounding enemies.
    2.  **Tome of Fire**: Fires projectile balls that inflict damage-over-time fire ticks.
    3.  **Tome of Poison**: Launches a toxic sphere that drains zombie health over 6 seconds.
    4.  **Tome of Frost**: Fires icy spikes that slow enemies, with a 40% chance to freeze them solid in ice blocks.
*   **PROCEDURAL AUDIO SYNTHESIZER**: Implements a zero-asset sound design engine using the Web Audio API. Math-based synthesizers generate ambient biome sounds (wind, magma pops, crickets), coin collections, and physical swing sounds unique to your weapon category (light blade swoosh, blunt club whoosh, heavy axe sweep).

---

## 🛠️ Technology Stack

*   **Vite**: Next-generation frontend tooling.
*   **TypeScript**: Static typing for clean, maintainable logic.
*   **HTML5 Canvas & 2D Context**: High-performance pixel rendering with depth (Y-sorting) rendering.
*   **Web Audio API**: Procedural sound generation without heavy asset loading overhead.
*   **Vanilla CSS**: Sleek glassmorphism HUD cards and retro overlays.

---

## 🚀 Installation & Running

Follow these steps to run the game locally:

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Install Dependencies
Clone this repository and run the following command in the project root:
```bash
npm install
```

### 3. Run Development Server
Start the local server to play:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your web browser.

### 4. Build for Production
To bundle and optimize the project for static hosting:
```bash
npm run build
```
The output files will be built into the `dist/` directory.

---

## 🕹️ Game Controls

*   **Movement**: `W` `A` `S` `D` or **Arrow Keys**
*   **Sprint**: Hold `Shift` (consumes stamina energy)
*   **Melee Attack**: `Spacebar` (consumes stamina)
*   **Interact (Shop / Doors)**: `F` / `E`
*   **Cast Spells**:
    *   `1`: Tome of Wrath (AOE)
    *   `2`: Tome of Fire (Fireball)
    *   `3`: Tome of Poison (Poisonball)
    *   `4`: Tome of Frost (Freeze block)

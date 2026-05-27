# OscillaMortis

An action-packed, web-based 2D survival slasher built with **TypeScript**, **Vite**, and **HTML5 Canvas**. Defend the **Biome Resonator** from escalating waves of elemental slimes and undead mobs, adapt to changing biomes, purchase weapons and spell tomes, and survive as long as you can.

---

## 🎮 Key Gameplay Features

- **DEFEND THE RESONATOR**: Protect the Biome Resonator at the center of the map. If it's destroyed, the run ends immediately.
- **WAVE SYSTEM**: Endless escalating waves with a prep phase between each one. Mob count and difficulty scale over time.
- **DYNAMIC BIOMES**: Four distinct environments with unique floor tiles, obstacles, ambient sounds, and lighting:
  - *Grasslands* — lush fields with shrubs, rocks, and tombstones.
  - *Desert* — sandy dunes with cacti, rocks, and tumbleweeds.
  - *Tundra* — frozen snowfields with ice blocks, pine trees, and shimmer highlights.
  - *Lava Fields* — volcanic terrain with magma paths and pulsing ambient glow.
- **MOB TYPES & AI**:
  - `Slime` — bouncy, splits into minislimes on death.
  - `Fire Slime` — inflicts burn (damage over time) on contact.
  - `Frost Slime` — slows the player on contact.
  - `Poison Slime` — poisons the player on contact.
  - `Walker` — slow shambling undead.
  - `Runner` — fast, relentless sprinter.
  - `Ghost` — phases through walls with motion trails and spectral glow.
  - `Skeleton` — ranged attacker that orbits and fires bone projectiles.
  - `Brute` — tanky mob that charges at high speed after a wind-up.
- **SHOP & TELEPORT**: After each wave, a teleport portal appears. Step through to enter the shop. Press **F** to buy items from stands, and **F** again at the exit to return. The portal disappears when not needed.
- **WEAPONS**: Wooden Sword, Short Sword, Wooden Club, Iron Sword, Baseball Bat, Machete, Fire Axe — each with unique stats, blade length, and swing sounds.
- **SPELL CASTING**: Purchase tomes and use `1`–`4` to cast:
  1. **Tome of Wrath (AOE)** — kinetic shockwave that blasts all nearby enemies.
  2. **Tome of Fire** — fireball that burns over time.
  3. **Tome of Poison** — toxic sphere that drains health over 6 seconds.
  4. **Tome of Frost** — icy spike that slows and has a chance to freeze enemies solid.
- **CONSUMABLES**: Health Elixirs, Greater Health Elixirs, Energy Tonics, Ironskin Brews, Swiftness Draughts, and Spellbooks.
- **PROCEDURAL AUDIO**: Zero-asset sound design using the Web Audio API. All sounds — ambient biome atmosphere, coin pickups, weapon swings, spell effects, and mob aggro — are synthesized in real time.

---

## 🛠️ Technology Stack

- **Vite** — fast dev server and bundler.
- **TypeScript** — fully typed, modular codebase.
- **HTML5 Canvas 2D** — Y-sorted depth rendering, sprite sheets, procedural mob drawing.
- **Web Audio API** — real-time procedural sound synthesis.
- **Vanilla CSS** — glassmorphism panels, VT323 pixel font title, retro overlays.

### Architecture

```
src/
├── main.ts              # Entry point (minimal)
├── engine/
│   ├── Game.ts          # Core game loop & orchestration
│   ├── Assets.ts        # Image/audio preloading & transparency processing
│   ├── Keyboard.ts      # Keyboard input manager
│   ├── Sound.ts         # Procedural audio synthesizer
│   └── Constants.ts     # Shared constants
├── entities/
│   ├── Player.ts        # Player movement, combat, drawing
│   ├── Mob.ts           # Unified mob entity (all types)
│   ├── LootDrop.ts      # Coin and item drops
│   └── mobs/
│       ├── SlimeBehavior.ts    # Slime AI & procedural drawing
│       ├── SkeletonBehavior.ts # Skeleton ranged AI
│       ├── BruteBehavior.ts    # Brute charge AI
│       └── ...
└── components/
    └── UI.ts            # Start screen, game over, interact prompts
```

---

## 🚀 Installation & Running

### 1. Prerequisites
[Node.js](https://nodejs.org/) v18+ required.

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production
```bash
npm run build
```
Output files will be in the `dist/` directory.

---

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `W` `A` `S` `D` / Arrow Keys | Move |
| `Shift` | Sprint (drains energy) |
| `Space` | Slash / Attack |
| `F` | Interact (buy from shop stand, enter/exit teleport) |
| `1` | Cast Tome of Wrath (AOE shockwave) |
| `2` | Cast Tome of Fire (fireball) |
| `3` | Cast Tome of Poison (poison bolt) |
| `4` | Cast Tome of Frost (frost spike) |

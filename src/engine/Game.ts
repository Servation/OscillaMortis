import { MAP_WIDTH, MAP_HEIGHT } from "./Constants";
import { sound } from "./Sound";
import { Keyboard } from "./Keyboard";
import { UIManager } from "../components/UI";
import { Player, type WeaponType, WEAPON_STATS } from "../entities/Player";
import { Mob, type MobType } from "../entities/Mob";
import { checkRectCollision, checkCircleSquareCollision } from "./Collision";
import { EnemyProjectile } from "../entities/EnemyProjectile";
import { BiomeResonator } from "../entities/BiomeResonator";
import { LootDrop } from "../entities/LootDrop";
import { CoinDrop } from "../entities/CoinDrop";
import { SpellProjectile } from "../entities/SpellProjectile";
import { Shockwave } from "../entities/Shockwave";
import type { Obstacle, FloorDecal } from "../entities/Obstacle";
import type { ShopStand, ConsumableItem, WeaponItem } from "../entities/ShopItem";
import { WEAPON_ITEMS, CONSUMABLE_ITEMS } from "../entities/ShopItem";
import { assets, itemImages, biomeImages, runnerSheet, ghostSheet, skeletonSheet, bruteSheet } from "./Assets";

interface DamagePuddle {
  x: number;
  y: number;
  radius: number;
  type: "fire" | "poison";
  life: number;
  maxLife: number;
}

export type BiomeType = "grass" | "desert" | "tundra" | "lava";

export class Game {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public keyboard: Keyboard;
  public ui: UIManager;

  // Entities and lists
  public player!: Player;
  public mobs: Mob[] = [];
  public enemyProjectiles: EnemyProjectile[] = [];
  public coinDrops: CoinDrop[] = [];
  public lootDrops: LootDrop[] = [];
  public spellProjectiles: SpellProjectile[] = [];
  public shockwaves: Shockwave[] = [];
  public obstacles: Obstacle[] = [];
  public floorDecals: FloorDecal[] = [];
  public damagePuddles: DamagePuddle[] = [];
  public resonator: BiomeResonator | null = null;

  public PORTAL_X = 640;
  public PORTAL_Y = 280;

  // Biome-specific cached canvases/patterns
  public currentBiome: BiomeType = "grass";
  public sandPattern: HTMLCanvasElement | null = null;
  public snowPattern: HTMLCanvasElement | null = null;
  public lavaPattern: HTMLCanvasElement | null = null;
  public biomeOverlayCanvas: HTMLCanvasElement | null = null;
  public lavaGlow1Canvas: HTMLCanvasElement | null = null;
  public lavaGlow2Canvas: HTMLCanvasElement | null = null;

  // Wave variables
  public waveNumber = 1;
  public wavePhase: "horde" | "prep" = "horde";
  public waveTotalMobs = 5;
  public waveSpawnsTriggered = 0;
  public waveKilledMobs = 0;
  public wavePrepTimer = 0;
  public prepTimerStarted = false;

  // Swarm Incursion State
  public activeIncursionDirection: "top" | "bottom" | "left" | "right" | null = null;
  public incursionWarningTimer = 0;
  public incursionSpawnsRemaining = 0;
  public currentIncursionIndex = 0;
  public incursionIntervalTimer = 0;

  // Shop Interior Variables
  public shopping = false;
  public shopAnnounceMessage = "";
  public shopAnnounceTimer = 0;
  public gameStarted = false;
  public gameCounter = 0;
  public magicCooldown = 0;
  public levelUpAlertText = "";
  public levelUpAlertTimer = 0;

  public shopStands: ShopStand[] = [
    { x: 380, y: 350, w: 50, h: 50, item: null }, // Consumable 1
    { x: 640, y: 350, w: 50, h: 50, item: null }, // Weapon
    { x: 900, y: 350, w: 50, h: 50, item: null }  // Consumable 2
  ];

  constructor(canvas: HTMLCanvasElement, keyboard: Keyboard, ui: UIManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.keyboard = keyboard;
    this.ui = ui;
  }

  public initGame(): void {
    this.gameCounter = 0;
    this.magicCooldown = 0;
    this.shopping = false;
    this.shopAnnounceTimer = 0;
    this.levelUpAlertTimer = 0;

    // Synthesize procedural audio effects
    sound.synthesize("slime_aggro", "slime_aggro");
    sound.synthesize("skeleton_aggro", "skeleton_aggro");
    sound.synthesize("ghost_aggro", "ghost_aggro");
    sound.synthesize("brute_aggro", "brute_aggro");
    sound.synthesize("runner_aggro", "runner_aggro");
    sound.synthesize("coin_pickup", "coin_pickup");
    sound.synthesize("spell_blast", "spell_blast");
    sound.synthesize("spell_fire", "spell_fire");
    sound.synthesize("spell_poison", "spell_poison");
    sound.synthesize("spell_frost", "spell_frost");
    sound.synthesize("swing_light", "swing_light");
    sound.synthesize("swing_heavy", "swing_heavy");
    sound.synthesize("swing_blunt", "swing_blunt");

    for (const stand of this.shopStands) {
      stand.item = null;
    }

    // Wave initialization
    this.waveNumber = 1;
    this.wavePhase = "horde";
    this.waveTotalMobs = 0; // Will be set dynamically by incursions
    this.waveSpawnsTriggered = 0;
    this.waveKilledMobs = 0;
    this.wavePrepTimer = 0;
    this.prepTimerStarted = false;

    this.activeIncursionDirection = null;
    this.incursionWarningTimer = 0;
    this.incursionSpawnsRemaining = 0;
    this.currentIncursionIndex = 0;
    this.incursionIntervalTimer = 0;

    // Initialize Player
    this.player = new Player(
      assets.playerWalking,
      assets.playerKnife,
      MAP_WIDTH,
      MAP_HEIGHT
    );

    this.resonator = new BiomeResonator();

    // Set starting biome (grass)
    this.generateProceduralBackgrounds();
    this.generateLavaGlowCanvases();
    this.setBiome("grass");

    // Clear lists
    this.spellProjectiles = [];
    this.lootDrops = [];
    this.shockwaves = [];
    this.enemyProjectiles = [];
    this.coinDrops = [];
    this.mobs = [];
    this.damagePuddles = [];
  }

  public generateFloorDecals(): void {
    this.floorDecals = [];
    const numDecals = 35 + Math.floor(Math.random() * 20); // 35 to 55 decals
    for (let i = 0; i < numDecals; i++) {
      let rx = Math.random() * MAP_WIDTH;
      let ry = Math.random() * MAP_HEIGHT;
      
      // Check distance to center area (avoid drawing decals under resonator/portal)
      const dx = rx - 640;
      const dy = ry - 400;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        continue;
      }

      this.floorDecals.push({
        x: rx,
        y: ry,
        size: 4 + Math.floor(Math.random() * 12),
        type: Math.floor(Math.random() * 3)
      });
    }
  }

  public drawFloorDecals(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const d of this.floorDecals) {
      if (this.currentBiome === "grass") {
        ctx.fillStyle = d.type === 0 ? "#166534" : d.type === 1 ? "#eab308" : "#ffffff";
        if (d.type === 0) {
          ctx.strokeStyle = "#166534";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - 3, d.y - d.size);
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x, d.y - d.size * 1.2);
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + 3, d.y - d.size);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(d.x, d.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (this.currentBiome === "desert") {
        if (d.type === 0) {
          ctx.strokeStyle = "rgba(180, 83, 9, 0.15)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size * 1.5, -Math.PI / 4, Math.PI / 4);
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(180, 83, 9, 0.25)";
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (this.currentBiome === "tundra") {
        if (d.type === 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "rgba(147, 197, 253, 0.4)";
          ctx.beginPath();
          ctx.moveTo(d.x, d.y - d.size * 0.5);
          ctx.lineTo(d.x + d.size * 0.3, d.y);
          ctx.lineTo(d.x, d.y + d.size * 0.5);
          ctx.lineTo(d.x - d.size * 0.3, d.y);
          ctx.closePath();
          ctx.fill();
        }
      } else if (this.currentBiome === "lava") {
        if (d.type === 0) {
          ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
          ctx.shadowColor = "#f97316";
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "rgba(30, 27, 75, 0.8)";
          ctx.beginPath();
          ctx.moveTo(d.x - 3, d.y + 2);
          ctx.lineTo(d.x, d.y - 4);
          ctx.lineTo(d.x + 3, d.y + 2);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  public drawDamagePuddles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const puddle of this.damagePuddles) {
      // Fade out puddle during the last 30 frames of life
      const alpha = puddle.life < 30 ? puddle.life / 30 : 1.0;

      ctx.shadowBlur = 10;
      if (puddle.type === "fire") {
        ctx.shadowColor = "rgba(239, 68, 68, 0.8)";

        // Outer rim
        const grad = ctx.createRadialGradient(puddle.x, puddle.y, 2, puddle.x, puddle.y, puddle.radius);
        grad.addColorStop(0, `rgba(253, 224, 71, ${0.85 * alpha})`); // Yellow
        grad.addColorStop(0.4, `rgba(249, 115, 22, ${0.6 * alpha})`);  // Orange
        grad.addColorStop(1, `rgba(220, 38, 38, 0)`);               // Fade red

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(puddle.x, puddle.y, puddle.radius, puddle.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing inner heat center
        const pulse = Math.sin(this.gameCounter * 0.1) * 3;
        ctx.fillStyle = `rgba(254, 240, 138, ${0.4 * alpha})`;
        ctx.beginPath();
        ctx.ellipse(puddle.x, puddle.y, (puddle.radius * 0.4) + pulse, ((puddle.radius * 0.4) + pulse) * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (puddle.type === "poison") {
        ctx.shadowColor = "rgba(168, 85, 247, 0.8)";

        // Toxic bubble puddle gradient
        const grad = ctx.createRadialGradient(puddle.x, puddle.y, 2, puddle.x, puddle.y, puddle.radius);
        grad.addColorStop(0, `rgba(168, 85, 247, ${0.8 * alpha})`); // Purple core
        grad.addColorStop(0.6, `rgba(34, 197, 94, ${0.5 * alpha})`);  // Green pool
        grad.addColorStop(1, `rgba(22, 163, 74, 0)`);                // Transparent border

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(puddle.x, puddle.y, puddle.radius, puddle.radius * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // Small bubbling circles
        ctx.fillStyle = `rgba(232, 121, 249, ${0.3 * alpha})`;
        const bob1 = Math.sin(this.gameCounter * 0.05) * (puddle.radius * 0.2);
        const bob2 = Math.cos(this.gameCounter * 0.07) * (puddle.radius * 0.25);

        ctx.beginPath();
        ctx.arc(puddle.x + bob1, puddle.y - 3 + bob2, 3, 0, Math.PI * 2);
        ctx.arc(puddle.x - 10 + bob2, puddle.y + 2 - bob1, 2.5, 0, Math.PI * 2);
        ctx.arc(puddle.x + 8 - bob2, puddle.y + 4 + bob1, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  public generateProceduralBackgrounds() {
    // 1. Sand / Desert (1280x800)
    const sandCanvas = document.createElement("canvas");
    sandCanvas.width = MAP_WIDTH;
    sandCanvas.height = MAP_HEIGHT;
    const sCtx = sandCanvas.getContext("2d")!;
    const sandImg = biomeImages.get("desert_floor");
    if (sandImg) {
      sCtx.drawImage(sandImg as HTMLImageElement, 0, 0, MAP_WIDTH, MAP_HEIGHT);
    } else {
      sCtx.fillStyle = "#fef08a";
      sCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    }
    this.sandPattern = sandCanvas;

    // 2. Snow / Tundra (1280x800)
    const snowCanvas = document.createElement("canvas");
    snowCanvas.width = MAP_WIDTH;
    snowCanvas.height = MAP_HEIGHT;
    const snCtx = snowCanvas.getContext("2d")!;
    const snowImg = biomeImages.get("tundra_floor");
    if (snowImg) {
      snCtx.drawImage(snowImg as HTMLImageElement, 0, 0, MAP_WIDTH, MAP_HEIGHT);
    } else {
      snCtx.fillStyle = "#f1f5f9";
      snCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    }
    this.snowPattern = snowCanvas;

    // 3. Lava Field (1280x800)
    const lavaCanvas = document.createElement("canvas");
    lavaCanvas.width = MAP_WIDTH;
    lavaCanvas.height = MAP_HEIGHT;
    const lCtx = lavaCanvas.getContext("2d")!;
    const lavaImg = biomeImages.get("lava_floor");
    if (lavaImg) {
      lCtx.drawImage(lavaImg as HTMLImageElement, 0, 0, MAP_WIDTH, MAP_HEIGHT);
    } else {
      lCtx.fillStyle = "#0c0a12";
      lCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    }
    this.lavaPattern = lavaCanvas;
  }

  public generateLavaGlowCanvases() {
    // Glow 1: Red radial glow, 800x800
    this.lavaGlow1Canvas = document.createElement("canvas");
    this.lavaGlow1Canvas.width = 800;
    this.lavaGlow1Canvas.height = 800;
    const ctx1 = this.lavaGlow1Canvas.getContext("2d")!;
    const grad1 = ctx1.createRadialGradient(400, 400, 50, 400, 400, 400);
    grad1.addColorStop(0, "rgba(239, 68, 68, 1)");
    grad1.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx1.fillStyle = grad1;
    ctx1.beginPath();
    ctx1.arc(400, 400, 400, 0, Math.PI * 2);
    ctx1.fill();

    // Glow 2: Orange radial glow, 700x700
    this.lavaGlow2Canvas = document.createElement("canvas");
    this.lavaGlow2Canvas.width = 700;
    this.lavaGlow2Canvas.height = 700;
    const ctx2 = this.lavaGlow2Canvas.getContext("2d")!;
    const grad2 = ctx2.createRadialGradient(350, 350, 100, 350, 350, 350);
    grad2.addColorStop(0, "rgba(249, 115, 22, 1)");
    grad2.addColorStop(1, "rgba(249, 115, 22, 0)");
    ctx2.fillStyle = grad2;
    ctx2.beginPath();
    ctx2.arc(350, 350, 350, 0, Math.PI * 2);
    ctx2.fill();
  }

  public generateBiomeOverlay(biome: BiomeType): void {
    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = MAP_WIDTH;
    overlayCanvas.height = MAP_HEIGHT;
    const oCtx = overlayCanvas.getContext("2d")!;
    
    oCtx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    
    let colors: string[] = [];
    if (biome === "grass") {
      colors = [
        "rgba(20, 83, 45, 0.18)",
        "rgba(132, 204, 22, 0.08)",
        "rgba(21, 128, 61, 0.12)",
        "rgba(6, 78, 59, 0.15)"
      ];
    } else if (biome === "desert") {
      colors = [
        "rgba(194, 65, 12, 0.14)",
        "rgba(253, 224, 71, 0.22)",
        "rgba(249, 115, 22, 0.10)",
        "rgba(120, 53, 15, 0.12)"
      ];
    } else if (biome === "tundra") {
      colors = [
        "rgba(14, 116, 144, 0.12)",
        "rgba(6, 182, 212, 0.08)",
        "rgba(148, 163, 184, 0.16)",
        "rgba(203, 213, 225, 0.10)"
      ];
    } else if (biome === "lava") {
      colors = [
        "rgba(2, 6, 23, 0.45)",
        "rgba(127, 29, 29, 0.15)",
        "rgba(154, 52, 18, 0.12)",
        "rgba(24, 24, 37, 0.35)"
      ];
    }

    const numGradients = 7;
    for (let i = 0; i < numGradients; i++) {
      const rx = Math.random() * MAP_WIDTH;
      const ry = Math.random() * MAP_HEIGHT;
      const radius = 200 + Math.random() * 300;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const grad = oCtx.createRadialGradient(rx, ry, radius * 0.1, rx, ry, radius);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      oCtx.fillStyle = grad;
      oCtx.beginPath();
      oCtx.arc(rx, ry, radius, 0, Math.PI * 2);
      oCtx.fill();
    }

    this.biomeOverlayCanvas = overlayCanvas;
  }

  public setBiome(biome: BiomeType) {
    this.currentBiome = biome;
    sound.playAmbience(biome);
    this.generateBiomeOverlay(biome);
    this.generateObstacles();
    this.generateFloorDecals();
  }

  public selectRandomBiome() {
    const biomes: BiomeType[] = ["grass", "desert", "tundra", "lava"];
    const oldBiome = this.currentBiome;
    let next = oldBiome;
    while (next === oldBiome) {
      next = biomes[Math.floor(Math.random() * biomes.length)];
    }
    this.setBiome(next);
  }

  public spawnMobFromDirection(dir: "top" | "bottom" | "left" | "right") {
    let spawnX = 0;
    let spawnY = 0;

    if (dir === "top") {
      spawnX = 60 + Math.random() * (MAP_WIDTH - 120);
      spawnY = -35;
    } else if (dir === "bottom") {
      spawnX = 60 + Math.random() * (MAP_WIDTH - 120);
      spawnY = MAP_HEIGHT + 25;
    } else if (dir === "right") {
      spawnX = MAP_WIDTH + 25;
      spawnY = 60 + Math.random() * (MAP_HEIGHT - 120);
    } else { // left
      spawnX = -35;
      spawnY = 60 + Math.random() * (MAP_HEIGHT - 120);
    }

    // Difficulty Type Distribution based on wave progress
    let type: MobType = "walker";
    const roll = Math.random();

    if (this.waveNumber === 1) {
      type = "slime";
    } else if (this.waveNumber === 2) {
      type = roll < 0.50 ? "slime" : "walker";
    } else if (this.waveNumber === 3) {
      if (roll < 0.20) type = "slime";
      else if (roll < 0.50) type = "runner";
      else type = "walker";
    } else if (this.waveNumber === 4) {
      if (roll < 0.20) type = "ghost";
      else if (roll < 0.40) type = "skeleton";
      else if (roll < 0.70) type = "runner";
      else type = "walker";
    } else {
      if (roll < 0.10) type = "slime";
      else if (roll < 0.25) type = "skeleton";
      else if (roll < 0.40) type = "ghost";
      else if (roll < 0.55) type = "brute";
      else if (roll < 0.80) type = "runner";
      else type = "walker";
    }

    // Randomize slime types to include elemental varieties
    if (type === "slime") {
      const sRoll = Math.random();
      if (sRoll < 0.40) type = "slime";
      else if (sRoll < 0.60) type = "fire_slime";
      else if (sRoll < 0.80) type = "frost_slime";
      else type = "poison_slime";
    }

    let mSheet: HTMLImageElement | HTMLCanvasElement = assets.zombie;
    if (type === "runner") mSheet = runnerSheet;
    else if (type === "ghost") mSheet = ghostSheet;
    else if (type === "skeleton") mSheet = skeletonSheet;
    else if (type === "brute") mSheet = bruteSheet;

    const m = new Mob(mSheet, MAP_WIDTH, MAP_HEIGHT, spawnX, spawnY, type);
    m.aggroTarget = Math.random() < 0.70 ? "resonator" : "player";

    this.mobs.push(m);
    this.waveSpawnsTriggered += 1;
  }

  public handlePlayerLevelUp = (newLvl: number) => {
    sound.play("button");
    this.levelUpAlertText = `LEVEL UP! LEVEL ${newLvl}`;
    this.levelUpAlertTimer = 120; // Show for 2 seconds (120 frames)
  };

  public handleMobDeath(mob: Mob) {
    mob.visible = false;
    this.waveKilledMobs += 1;
    
    // Coin rewards
    const numCoins = Math.floor(Math.random() * (mob.coinRewardMax - mob.coinRewardMin + 1)) + mob.coinRewardMin;
    const cx = mob.x + mob.width / 2;
    const cy = mob.y + mob.height / 2;
    for (let i = 0; i < numCoins; i++) {
      this.coinDrops.push(new CoinDrop(cx, cy, 1));
    }

    // 10% chance to drop a random spell book
    if (Math.random() < 0.10) {
      const spellTypes: ("aoe" | "fire" | "poison" | "frost")[] = ["aoe", "fire", "poison", "frost"];
      const chosenType = spellTypes[Math.floor(Math.random() * spellTypes.length)];
      this.lootDrops.push(new LootDrop(cx, cy, chosenType));
    }

    // 5% chance to drop a health or energy potion on the ground
    if (Math.random() < 0.05) {
      const potionType = Math.random() < 0.5 ? "health" : "energy";
      this.lootDrops.push(new LootDrop(cx, cy, potionType));
    }

    // XP progression values
    let xpVal = 10;
    if (mob.mobType === "brute") xpVal = 30;
    else if (mob.mobType === "runner" || mob.mobType === "ghost" || mob.mobType === "skeleton") xpVal = 15;
    else if (mob.mobType === "slime" || mob.mobType === "fire_slime" || mob.mobType === "frost_slime" || mob.mobType === "poison_slime") xpVal = 12;
    else if (mob.mobType === "minislime" || mob.mobType === "fire_minislime" || mob.mobType === "frost_minislime" || mob.mobType === "poison_minislime") xpVal = 5;

    this.player.addXP(xpVal, this.handlePlayerLevelUp);

    // Slime splitting logic
    if (mob.mobType === "slime" || mob.mobType === "fire_slime" || mob.mobType === "frost_slime" || mob.mobType === "poison_slime") {
      const splitCount = 2;
      this.waveTotalMobs += splitCount; // add minislimes to the wave total so clearing works
      let childType: MobType = "minislime";
      if (mob.mobType === "fire_slime") childType = "fire_minislime";
      else if (mob.mobType === "frost_slime") childType = "frost_minislime";
      else if (mob.mobType === "poison_slime") childType = "poison_minislime";

      for (let i = 0; i < splitCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spawnX = mob.x + Math.cos(angle) * 20;
        const spawnY = mob.y + Math.sin(angle) * 20;
        this.mobs.push(new Mob(assets.zombie, MAP_WIDTH, MAP_HEIGHT, spawnX, spawnY, childType));
      }
    }

    // Spawns environmental damage puddles on elemental death
    if (mob.mobType === "fire_slime" || mob.mobType === "fire_minislime") {
      this.damagePuddles.push({
        x: cx,
        y: cy,
        radius: mob.isMinislime ? 24 : 38,
        type: "fire",
        life: 180, // 3 seconds
        maxLife: 180
      });
    } else if (mob.mobType === "poison_slime" || mob.mobType === "poison_minislime") {
      this.damagePuddles.push({
        x: cx,
        y: cy,
        radius: mob.isMinislime ? 24 : 38,
        type: "poison",
        life: 210, // 3.5 seconds
        maxLife: 210
      });
    }
  }

  public handleInput() {
    if (this.player.knifing) return; // Freeze normal input during knifing animation

    let mx = 0;
    let my = 0;

    if (this.keyboard.isPressed("w") || this.keyboard.isPressed("arrowup")) {
      my = -1;
    } else if (this.keyboard.isPressed("s") || this.keyboard.isPressed("arrowdown")) {
      my = 1;
    }

    if (this.keyboard.isPressed("a") || this.keyboard.isPressed("arrowleft")) {
      mx = -1;
    } else if (this.keyboard.isPressed("d") || this.keyboard.isPressed("arrowright")) {
      mx = 1;
    }

    // Running speed modifier
    const runActive = this.keyboard.isPressed("shift") && this.player.Energy > 1;
    this.player.running = runActive;

    const currentMaxSpeed = runActive ? 4.0 : 2.0;

    // Apply movement speeds
    if (mx !== 0) {
      this.player.speedX = mx * currentMaxSpeed;
      this.player.moving = true;

      const targetDir = mx > 0 ? 27 : 9;
      const targetGroup = mx > 0 ? 3 : 1;
      if (this.player.getDirectionGroup() !== targetGroup) {
        this.player.direction = targetDir;
      }
    }
    if (my !== 0) {
      this.player.speedY = my * currentMaxSpeed;
      this.player.moving = true;
      // Set direction facing up/down if not moving horizontally
      if (mx === 0) {
        const targetDir = my > 0 ? 18 : 0;
        const targetGroup = my > 0 ? 2 : 0;
        if (this.player.getDirectionGroup() !== targetGroup) {
          this.player.direction = targetDir;
        }
      }
    }

    // Trigger Melee Knife Action
    if (this.keyboard.isPressed(" ") && this.player.Energy > 10) {
      this.player.knifing = true;
      this.player.knifeCounter = 0;
      
      // Choose swing sound based on weapon category
      let swingSound = "swing_light";
      if (this.player.currentWeapon === "Wooden Club" || this.player.currentWeapon === "Baseball Bat") {
        swingSound = "swing_blunt";
      } else if (this.player.currentWeapon === "Iron Sword" || this.player.currentWeapon === "Fire Axe") {
        swingSound = "swing_heavy";
      }
      sound.play(swingSound);
    }

    // Trigger Spell Tomes Action
    if (this.magicCooldown <= 0) {
      let aimAngle = 0;
      if (mx !== 0 || my !== 0) {
        aimAngle = Math.atan2(my, mx);
      } else {
        const dirGroup = this.player.getDirectionGroup();
        if (dirGroup === 0) aimAngle = -Math.PI / 2; // UP
        else if (dirGroup === 1) aimAngle = Math.PI; // LEFT
        else if (dirGroup === 2) aimAngle = Math.PI / 2; // DOWN
        else aimAngle = 0; // RIGHT
      }

      if (this.keyboard.isPressed("1") && this.player.tomes.aoe > 0) {
        this.player.tomes.aoe--;
        this.magicCooldown = 30; // ~0.5s cooldown
        sound.play("spell_blast", 0.6);
        this.shockwaves.push(new Shockwave(this.player.x + 30, this.player.y + 32));
      } else if (this.keyboard.isPressed("2") && this.player.tomes.fire > 0) {
        this.player.tomes.fire--;
        this.magicCooldown = 30;
        sound.play("spell_fire", 0.6);
        this.spellProjectiles.push(new SpellProjectile(this.player.x + 30, this.player.y + 32, aimAngle, "fire"));
      } else if (this.keyboard.isPressed("3") && this.player.tomes.poison > 0) {
        this.player.tomes.poison--;
        this.magicCooldown = 30;
        sound.play("spell_poison", 0.6);
        this.spellProjectiles.push(new SpellProjectile(this.player.x + 30, this.player.y + 32, aimAngle, "poison"));
      } else if (this.keyboard.isPressed("4") && this.player.tomes.frost > 0) {
        this.player.tomes.frost--;
        this.magicCooldown = 30;
        sound.play("spell_frost", 0.6);
        this.spellProjectiles.push(new SpellProjectile(this.player.x + 30, this.player.y + 32, aimAngle, "frost"));
      }
    }
  }

  public processKnifing() {
    if (!this.player.knifing) return;

    const stats = this.player.getWeaponStats();
    const speed = stats.swingSpeed;

    if (this.gameCounter % speed === 0) {
      this.player.knifeCounter += 1;
    }

    // Resolve hits when swing completes
    if (this.player.knifeCounter > 5) {
      const knifeHitbox = this.player.getKnifeHitbox();

      for (let i = 0; i < this.mobs.length; i++) {
        const mob = this.mobs[i];
        if (mob.visible) {
          const hit = checkRectCollision(
            knifeHitbox.x, knifeHitbox.y, knifeHitbox.w, knifeHitbox.h,
            mob.x, mob.y, mob.width, mob.height
          );

          if (hit) {
            // Swing Damage from weapon stats
            const baseDmg = stats.baseDmg;
            mob.Health -= baseDmg * this.player.sMultiplier;
            mob.aggroTarget = "player"; // Pull aggro!

            // Swing Knockback based on weapon range / stats
            const knockForce = stats.range === "large" ? 18 :
                               stats.range === "medium" ? 12 : 8;
                               
            switch (knifeHitbox.direction) {
              case 0: mob.speedY -= knockForce; break;
              case 2: mob.speedY += knockForce; break;
              case 1: mob.speedX -= knockForce; break;
              case 3: mob.speedX += knockForce; break;
            }

            // Check if mob died
            if (mob.Health <= 0) {
              this.handleMobDeath(mob);
            }
          }
        }
      }

      // Reset swing states
      this.player.knifeCounter = 0;
      this.player.Energy -= 10;
      this.player.knifing = false;
    }
  }

  public updateSpells() {
    if (this.magicCooldown > 0) this.magicCooldown--;

    // Update Spell Projectiles
    for (let i = this.spellProjectiles.length - 1; i >= 0; i--) {
      const proj = this.spellProjectiles[i];
      proj.update();

      if (!proj.active) {
        this.spellProjectiles.splice(i, 1);
        continue;
      }

      // Check hit against mobs
      for (let j = 0; j < this.mobs.length; j++) {
        const mob = this.mobs[j];
        if (mob.visible) {
          const hit = checkCircleSquareCollision(
            proj.x, proj.y, proj.radius,
            mob.x, mob.y, mob.width, mob.height
          );

          if (hit) {
            mob.aggroTarget = "player"; // Pull aggro!
            const dmgMultiplier = this.player.magicDamageMultiplier;
            if (proj.type === "fire") {
              mob.Health -= 20 * dmgMultiplier;
              mob.fireTicks = 90; // 1.5 seconds (at 60fps)
            } else if (proj.type === "poison") {
              mob.Health -= 10 * dmgMultiplier;
              mob.poisonTicks = 360; // 6 seconds
            } else if (proj.type === "frost") {
              mob.Health -= 15 * dmgMultiplier;
              mob.freezeTicks = 240; // 4 seconds slow
              if (Math.random() < 0.40) {
                mob.isFrozenBlock = true;
                mob.frozenBlockTicks = 180; // 3 seconds frozen solid
              }
            }
            proj.active = false;

            if (mob.Health <= 0) {
              this.handleMobDeath(mob);
            }
            break;
          }
        }
      }
    }

    // Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const wave = this.shockwaves[i];
      wave.update();

      if (!wave.active) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      for (let j = 0; j < this.mobs.length; j++) {
        const mob = this.mobs[j];
        if (mob.visible && !wave.hitMobs.has(mob)) {
          const zcx = mob.x + mob.width / 2;
          const zcy = mob.y + mob.height / 2;
          const dx = zcx - wave.x;
          const dy = zcy - wave.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= wave.radius) {
            wave.hitMobs.add(mob);
            mob.aggroTarget = "player"; // Pull aggro!
            mob.Health -= 50 * this.player.magicDamageMultiplier;

            // Apply knockback
            const knockForce = 18;
            const angle = Math.atan2(dy, dx);
            mob.speedX += Math.cos(angle) * knockForce;
            mob.speedY += Math.sin(angle) * knockForce;

            if (mob.Health <= 0) {
              this.handleMobDeath(mob);
            }
          }
        }
      }
    }
  }

  public checkPortalProximity(): boolean {
    if (this.shopping || this.wavePhase !== "prep") return false;

    const cx = this.player.x + 15; // player center X
    const cy = this.player.y + 30; // player center Y
    const dx = cx - this.PORTAL_X;
    const dy = cy - this.PORTAL_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= 35; // 35px radius proximity
  }

  public drawTeleportPortal(ctx: CanvasRenderingContext2D) {
    if (this.wavePhase !== "prep" || this.shopping) return;

    ctx.save();
    ctx.translate(this.PORTAL_X, this.PORTAL_Y);

    // 1. Outer spinning ring
    const rotation = this.gameCounter * 0.02;
    ctx.rotate(rotation);

    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 30);
    grad.addColorStop(0, "rgba(59, 130, 246, 0.8)"); // Blue
    grad.addColorStop(0.5, "rgba(139, 92, 246, 0.4)"); // Purple
    grad.addColorStop(1, "rgba(139, 92, 246, 0)"); // Transparent

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();

    // 2. Swirling portal arcs
    ctx.strokeStyle = "rgba(147, 197, 253, 0.8)";
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 20 + i * 2, i * Math.PI / 2, i * Math.PI / 2 + Math.PI / 3);
      ctx.stroke();
    }

    // 3. Central bright core
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#3b82f6";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 6 + Math.sin(this.gameCounter * 0.15) * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  public checkShopExitProximity(): boolean {
    if (!this.shopping) return false;
    const cx = this.player.x + 15;
    const cy = this.player.y + 60;
    return cx >= 580 && cx <= 700 && cy >= 730;
  }

  public generateShopInventory(): void {
    // 1. Pick weapon
    let totalWeaponWeight = WEAPON_ITEMS.reduce((sum, item) => sum + item.weight, 0);
    let rollWeapon = Math.random() * totalWeaponWeight;
    let chosenWeapon: WeaponItem = WEAPON_ITEMS[0];
    let accumulated = 0;
    for (const item of WEAPON_ITEMS) {
      accumulated += item.weight;
      if (rollWeapon <= accumulated) {
        chosenWeapon = item;
        break;
      }
    }

    // 2. Pick consumable 1
    let totalConsumableWeight = CONSUMABLE_ITEMS.reduce((sum, item) => sum + item.weight, 0);
    let rollConsumable1 = Math.random() * totalConsumableWeight;
    let chosenConsumable1: ConsumableItem = CONSUMABLE_ITEMS[0];
    accumulated = 0;
    for (const item of CONSUMABLE_ITEMS) {
      accumulated += item.weight;
      if (rollConsumable1 <= accumulated) {
        chosenConsumable1 = item;
        break;
      }
    }

    // 3. Pick consumable 2 (different category from consumable 1)
    let chosenConsumable2: ConsumableItem = CONSUMABLE_ITEMS[0];
    let retries = 0;
    while (retries < 15) {
      let rollConsumable2 = Math.random() * totalConsumableWeight;
      accumulated = 0;
      for (const item of CONSUMABLE_ITEMS) {
        accumulated += item.weight;
        if (rollConsumable2 <= accumulated) {
          chosenConsumable2 = item;
          break;
        }
      }
      const cat1 = chosenConsumable1.consumableType.split('_')[0];
      const cat2 = chosenConsumable2.consumableType.split('_')[0];
      if (cat1 !== cat2) {
        break;
      }
      retries++;
    }

    // Assign to pedestals
    this.shopStands[0].item = {
      type: "consumable",
      name: chosenConsumable1.name,
      cost: chosenConsumable1.cost,
      tier: chosenConsumable1.tier,
      purchased: false,
      consumableType: chosenConsumable1.consumableType,
      description: chosenConsumable1.description,
      onBuy: chosenConsumable1.onBuy
    };

    this.shopStands[1].item = {
      type: "weapon",
      name: chosenWeapon.weaponType,
      cost: chosenWeapon.cost,
      tier: chosenWeapon.tier,
      purchased: false,
      weaponType: chosenWeapon.weaponType
    };

    this.shopStands[2].item = {
      type: "consumable",
      name: chosenConsumable2.name,
      cost: chosenConsumable2.cost,
      tier: chosenConsumable2.tier,
      purchased: false,
      consumableType: chosenConsumable2.consumableType,
      description: chosenConsumable2.description,
      onBuy: chosenConsumable2.onBuy
    };
  }

  public checkShopStandsInteractions() {
    if (!this.shopping) return;

    const cx = this.player.x + 15;
    const cy = this.player.y + 60;
    let activePrompt = "";

    for (const stand of this.shopStands) {
      const item = stand.item;
      if (!item || item.purchased) continue; // Skip empty/purchased stands

      // Proximity within 65px
      const dx = cx - stand.x;
      const dy = cy - stand.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 65) {
        if (item.type === "weapon") {
          activePrompt = `Press [F] to buy ${item.name} (${item.cost} Coins)`;
        } else {
          activePrompt = `Press [F] to buy ${item.name} - ${item.description} (${item.cost} Coins)`;
        }

        if (this.keyboard.isPressed("f")) {
          if (this.player.Coin >= item.cost) {
            this.player.Coin -= item.cost;
            item.purchased = true;
            sound.play("button");
            
            if (item.type === "weapon") {
              this.player.currentWeapon = item.weaponType!;
              this.shopAnnounceMessage = `UNLOCKED: ${item.name.toUpperCase()}!`;
            } else {
              const msg = item.onBuy!(this.player);
              this.shopAnnounceMessage = msg;
            }
            
            this.shopAnnounceTimer = 120;
            this.keyboard.clear();
          } else {
            this.shopAnnounceMessage = "NOT ENOUGH COINS!";
            this.shopAnnounceTimer = 90;
            sound.play("button");
            this.keyboard.clear();
          }
        }
        break;
      }
    }

    // Display prompt overlay
    if (activePrompt) {
      this.ui.showInteractPrompt(true, activePrompt);
    } else {
      // Check if exit prompt is active instead
      const nearExit = this.checkShopExitProximity();
      if (nearExit) {
        this.ui.showInteractPrompt(true, "Press [F] to Exit Shop");
        if (this.keyboard.isPressed("f")) {
          this.exitShop();
        }
      } else {
        this.ui.showInteractPrompt(false);
      }
    }
  }

  public enterShop() {
    this.shopping = true;
    this.keyboard.clear();
    
    // Generate randomized shop inventory on entering
    this.generateShopInventory();

    // Teleport player centered at the bottom of the room
    this.player.x = 640 - 15;
    this.player.y = 650;
    this.player.speedX = 0;
    this.player.speedY = 0;
    this.player.moving = false;
    this.player.running = false;
  }

  public exitShop() {
    this.shopping = false;
    this.keyboard.clear();
    // Teleport outside in front of portal
    this.player.x = this.PORTAL_X - 15;
    this.player.y = this.PORTAL_Y + 50;

    // Reset speed/movement states to fix exit-shop speed bug
    this.player.speedX = 0;
    this.player.speedY = 0;
    this.player.moving = false;
    this.player.running = false;

    // Wave prep timer starts counting down now, capped at 5 seconds
    this.wavePrepTimer = 300;
    this.prepTimerStarted = true;
  }

  public updateWaveSystem() {
    if (this.wavePhase === "horde") {
      // Incursion Progression
      const incursionsTotal = 2 + Math.floor(this.waveNumber / 2);
      this.incursionIntervalTimer++;

      // Check if we need to start/queue a new incursion
      if (this.activeIncursionDirection === null && this.incursionSpawnsRemaining === 0 && this.currentIncursionIndex < incursionsTotal) {
        let shouldQueue = false;
        if (this.currentIncursionIndex === 0) {
          shouldQueue = true; // Start first incursion immediately
        } else if (this.mobs.length === 0) {
          shouldQueue = true; // Queue if all previous mobs are dead
        } else if (this.incursionIntervalTimer >= 900) { // 15 seconds
          shouldQueue = true; // Queue after 15 seconds interval
        }
        
        if (shouldQueue) {
          const dirs: ("top" | "bottom" | "left" | "right")[] = ["top", "bottom", "left", "right"];
          this.activeIncursionDirection = dirs[Math.floor(Math.random() * dirs.length)];
          this.incursionWarningTimer = 120; // 2 seconds warning
          const groupSize = Math.min(10, 3 + this.waveNumber);
          this.incursionSpawnsRemaining = groupSize;
          this.waveTotalMobs += groupSize;
          this.currentIncursionIndex++;
          this.incursionIntervalTimer = 0;
        }
      }

      if (this.activeIncursionDirection !== null) {
        if (this.incursionWarningTimer > 0) {
          this.incursionWarningTimer--;
        } else if (this.incursionSpawnsRemaining > 0) {
          if (this.gameCounter % 15 === 0) {
            this.spawnMobFromDirection(this.activeIncursionDirection);
            this.incursionSpawnsRemaining--;
            if (this.incursionSpawnsRemaining === 0) {
              this.activeIncursionDirection = null;
            }
          }
        }
      }

      // Check if wave is fully cleared
      if (this.currentIncursionIndex === incursionsTotal && this.incursionSpawnsRemaining === 0 && this.waveKilledMobs >= this.waveTotalMobs) {
        this.wavePhase = "prep";
        this.wavePrepTimer = 2700; // 45 seconds countdown
        this.prepTimerStarted = false; // Pause timer until they exit the shop
        sound.play("button");

        // Calculate gold bonus based on remaining Resonator health
        let bonusText = "";
        if (this.resonator) {
          const coinBonus = Math.floor(50 * (this.resonator.health / this.resonator.maxHealth));
          this.player.Coin += coinBonus;
          bonusText = ` RESONATOR BONUS: +${coinBonus} COINS!`;
          this.resonator.health = this.resonator.maxHealth; // Restore resonator health
        }

        this.shopAnnounceMessage = `WAVE CLEARED! SHOP OPENED!${bonusText}`;
        this.shopAnnounceTimer = 180;
        this.mobs = [];
      }
    } else if (this.wavePhase === "prep") {
      // Count down Prep Timer only if started and not inside shop
      if (this.prepTimerStarted && !this.shopping) {
        if (this.wavePrepTimer > 0) {
          this.wavePrepTimer--;
        } else {
          // Countdown ended, force start wave
          this.startNextWave();
        }
      }
    }
  }

  public startNextWave() {
    if (this.shopping) {
      this.exitShop();
    }
    this.wavePhase = "horde";
    this.waveNumber += 1;
    
    this.waveTotalMobs = 0; // Will be set dynamically by incursions
    this.waveSpawnsTriggered = 0;
    this.waveKilledMobs = 0;
    this.wavePrepTimer = 0;
    this.prepTimerStarted = false;

    this.activeIncursionDirection = null;
    this.incursionWarningTimer = 0;
    this.incursionSpawnsRemaining = 0;
    this.currentIncursionIndex = 0;
    this.incursionIntervalTimer = 0;

    if (this.resonator) {
      this.resonator.health = this.resonator.maxHealth;
    }

    this.mobs = [];
    this.spellProjectiles = [];
    this.lootDrops = [];
    this.shockwaves = [];
    this.enemyProjectiles = [];
    this.coinDrops = [];
    this.selectRandomBiome();
    
    // Clear player per-wave temporary buffs
    this.player.clearWaveBuffs();

    sound.play("button");
    this.shopAnnounceMessage = `WAVE ${this.waveNumber} STARTING!`;
    this.shopAnnounceTimer = 120;
  }

  public updatePhysics() {
    if (!this.gameStarted || this.player.Health <= 0) return;

    // Shopping Scene Bounds & movement
    if (this.shopping) {
      let sx = 0;
      let sy = 0;
      if (this.keyboard.isPressed("w") || this.keyboard.isPressed("arrowup")) sy = -3.0;
      else if (this.keyboard.isPressed("s") || this.keyboard.isPressed("arrowdown")) sy = 3.0;

      if (this.keyboard.isPressed("a") || this.keyboard.isPressed("arrowleft")) sx = -3.0;
      else if (this.keyboard.isPressed("d") || this.keyboard.isPressed("arrowright")) sx = 3.0;

      this.player.speedX = sx;
      this.player.speedY = sy;
      this.player.moving = sx !== 0 || sy !== 0;

      if (sx !== 0) {
        const targetDir = sx > 0 ? 27 : 9;
        const targetGroup = sx > 0 ? 3 : 1;
        if (this.player.getDirectionGroup() !== targetGroup) {
          this.player.direction = targetDir;
        }
      } else if (sy !== 0) {
        const targetDir = sy > 0 ? 18 : 0;
        const targetGroup = sy > 0 ? 2 : 0;
        if (this.player.getDirectionGroup() !== targetGroup) {
          this.player.direction = targetDir;
        }
      } else {
        // Standing still inside shop - reset to standing frame
        const dir = this.player.direction;
        if (dir <= 8) this.player.direction = 0;
        else if (dir <= 17) this.player.direction = 9;
        else if (dir <= 26) this.player.direction = 18;
        else this.player.direction = 27;
      }

      if (this.gameCounter % 6 === 0) {
        this.player.animateWalking();
      }

      this.player.x += this.player.speedX;
      this.player.y += this.player.speedY;

      // Boundaries check for Shop Room (800x800 centered: x from 240 to 1040, y from 0 to 800)
      if (this.player.x < 245) this.player.x = 245;
      else if (this.player.x > 1035 - 30) this.player.x = 1035 - 30;

      if (this.player.y < 35) this.player.y = 35;
      else if (this.player.y > 765 - 60) this.player.y = 765 - 60;

      // Check interaction pedestals and E triggers
      this.checkShopStandsInteractions();

    } else {
      // Main Overworld Physics
      this.handleInput();

      const hasInput = this.keyboard.isPressed("w") || this.keyboard.isPressed("arrowup") ||
                       this.keyboard.isPressed("s") || this.keyboard.isPressed("arrowdown") ||
                       this.keyboard.isPressed("a") || this.keyboard.isPressed("arrowleft") ||
                       this.keyboard.isPressed("d") || this.keyboard.isPressed("arrowright");

      // Player walking animation timing
      const runMod = this.player.running ? 3 : 6;
      if (this.gameCounter % runMod === 0) {
        this.player.animateWalking();
        if (this.player.running) {
          this.player.Energy = Math.max(0, this.player.Energy - 0.5);
        }
      }

      // Energy recovery
      if (this.player.Energy < 100 && !this.player.running) {
        this.player.Energy = Math.min(100, this.player.Energy + this.player.energyRegenRate);
      }

      this.processKnifing();
      this.updateSpells();
      
      // Separate axis movement & collision for smooth sliding
      this.player.updateX();
      this.resolveObstaclesCollisionX(this.player, 14);

      this.player.updateY();
      this.resolveObstaclesCollisionY(this.player, 14);

      // Resolve collision with Biome Resonator
      if (this.resonator && this.resonator.health > 0) {
        const pCx = this.player.x + 29;
        const pCy = this.player.y + 59;
        const dx = pCx - this.resonator.x;
        const dy = pCy - this.resonator.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = this.resonator.radius + 14;
        if (dist < minDist) {
          const push = minDist - dist;
          if (dist > 0) {
            this.player.x += (dx / dist) * push;
            this.player.y += (dy / dist) * push;
          } else {
            this.player.y += push;
          }
        }
      }

      this.player.postUpdate(hasInput);

      // Update Coin Drops
      for (let i = this.coinDrops.length - 1; i >= 0; i--) {
        const coin = this.coinDrops[i];
        coin.update(this.player);
        if (!coin.active) {
          this.coinDrops.splice(i, 1);
        }
      }

      // Update Loot Drops (spell tomes, potions)
      for (let i = this.lootDrops.length - 1; i >= 0; i--) {
        const drop = this.lootDrops[i];
        drop.update(this.player);
        if (!drop.active) {
          this.lootDrops.splice(i, 1);
        }
      }

      // Update Damage Puddles (ground hazards)
      for (let i = this.damagePuddles.length - 1; i >= 0; i--) {
        const puddle = this.damagePuddles[i];
        puddle.life--;

        // Collision check with player center (player feet is player.x + 15, player.y + 50)
        const pCx = this.player.x + 15;
        const pCy = this.player.y + 50;
        const dx = pCx - puddle.x;
        const dy = pCy - puddle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < puddle.radius + 14) {
          if (puddle.type === "fire") {
            this.player.fireTicks = Math.max(this.player.fireTicks, 45); // refresh burn
            this.player.Health = Math.max(0, this.player.Health - 0.1); // extra damage while standing on it
          } else if (puddle.type === "poison") {
            this.player.poisonTicks = Math.max(this.player.poisonTicks, 60); // refresh poison
            this.player.Health = Math.max(0, this.player.Health - 0.05); // extra damage while standing on it
          }
        }

        if (puddle.life <= 0) {
          this.damagePuddles.splice(i, 1);
        }
      }

      // Update Mobs AI and movement
      for (let i = 0; i < this.mobs.length; i++) {
        const mob = this.mobs[i];
        mob.runAI(
          this.player,
          this.resonator,
          this.gameCounter,
          (sfx) => sound.play(sfx),
          (sx, sy, tx, ty) => {
            this.enemyProjectiles.push(new EnemyProjectile(sx, sy, tx, ty, 6)); // skeleton bone deals 6 damage
          }
        );

        if (this.gameCounter % 10 === 0) {
          mob.animate();
        }

        mob.update();
        if (mob.mobType !== "ghost") {
          this.resolveObstaclesCollisionAll(mob, 14);

          // Resolve collision with Biome Resonator
          if (this.resonator && this.resonator.health > 0) {
            const zCx = mob.x + 29;
            const zCy = mob.y + 59;
            const dx = zCx - this.resonator.x;
            const dy = zCy - this.resonator.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = this.resonator.radius + 14;
            if (dist < minDist) {
              const push = minDist - dist;
              if (dist > 0) {
                mob.x += (dx / dist) * push;
                mob.y += (dy / dist) * push;
              } else {
                mob.y += push;
              }
            }
          }

          // Resolve collision with player feet circle to prevent overlapping
          const pCx = this.player.x + 29;
          const pCy = this.player.y + 59;
          const zCx = mob.x + 29;
          const zCy = mob.y + 59;
          const dx = zCx - pCx;
          const dy = zCy - pCy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          const minPlayerDist = 28; // player radius (14) + mob radius (14)
          if (dist < minPlayerDist) {
            const pushDist = minPlayerDist - dist;
            if (dist > 0) {
              mob.x += (dx / dist) * pushDist;
              mob.y += (dy / dist) * pushDist;
            } else {
              const angle = Math.random() * Math.PI * 2;
              mob.x += Math.cos(angle) * pushDist;
              mob.y += Math.sin(angle) * pushDist;
            }
          }
        }
      }

      // Resolve mob-mob collisions to prevent swarms from stacking
      for (let i = 0; i < this.mobs.length; i++) {
        const z1 = this.mobs[i];
        if (z1.mobType === "ghost" || !z1.visible) continue;
        for (let j = i + 1; j < this.mobs.length; j++) {
          const z2 = this.mobs[j];
          if (z2.mobType === "ghost" || !z2.visible) continue;
          
          const dx = (z2.x + 29) - (z1.x + 29);
          const dy = (z2.y + 59) - (z1.y + 59);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = 24; // slightly smaller than 28 so they can overlap a tiny bit but stay separated
          
          if (dist < minDist) {
            const push = (minDist - dist) / 2;
            const angle = dist > 0 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
            const pushX = Math.cos(angle) * push;
            const pushY = Math.sin(angle) * push;
            
            z1.x -= pushX;
            z1.y -= pushY;
            z2.x += pushX;
            z2.y += pushY;
          }
        }
      }

      // Update Enemy Projectiles
      for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
        const bone = this.enemyProjectiles[i];
        bone.update();

        if (!bone.active) {
          this.enemyProjectiles.splice(i, 1);
          continue;
        }

        // Check hit against player bounding box (Hero: player.x + 15, player.y, 30, 60)
        const hit = checkCircleSquareCollision(
          bone.x, bone.y, bone.radius,
          this.player.x + 15, this.player.y, 30, 60
        );

        if (hit) {
          this.player.takeDamage(bone.damage);
          bone.active = false;
          sound.play("button"); // play hit sound
        }
      }

      // Proximity to enter teleport portal
      const isNearPortal = this.checkPortalProximity();

      if (isNearPortal) {
        this.ui.showInteractPrompt(true, "Press [F] to Enter Teleport");
        if (this.keyboard.isPressed("f")) {
          sound.play("button");
          this.enterShop();
        }
      } else {
        this.ui.showInteractPrompt(false);
      }
    }

    // Wave system ticked every frame
    this.updateWaveSystem();

    // Tick Alerts
    if (this.levelUpAlertTimer > 0) this.levelUpAlertTimer--;
    if (this.shopAnnounceTimer > 0) this.shopAnnounceTimer--;

    this.gameCounter++;
  }

  // Standalone drawing helpers
  public drawWeaponStandalone(ctx: CanvasRenderingContext2D, x: number, y: number, type: WeaponType, angle: number, sizeScale: number = 1.0) {
    const img = itemImages.get(type);
    if (img) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sizeScale, sizeScale);
      ctx.rotate(angle);
      ctx.drawImage(img, -24, -44, 48, 48);
      ctx.restore();
      return;
    }
    const stats = WEAPON_STATS[type];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sizeScale, sizeScale);
    ctx.rotate(angle);

    if (stats.tier >= 2) {
      ctx.shadowColor = stats.glowColor;
      ctx.shadowBlur = stats.tier >= 3 ? 12 : 6;
    }

    ctx.fillStyle = "#4a3728";
    ctx.fillRect(-2, -2, 4, 10);

    ctx.fillStyle = stats.color;
    ctx.fillRect(
      -stats.bladeWidth / 2,
      -stats.bladeLength,
      stats.bladeWidth,
      stats.bladeLength
    );

    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(
      -stats.bladeWidth / 2,
      -stats.bladeLength,
      Math.max(1, stats.bladeWidth / 3),
      stats.bladeLength
    );

    if (stats.range !== "large" && type !== "Wooden Club") {
      ctx.fillStyle = stats.tier >= 2 ? "#d4af37" : "#6b7280";
      ctx.fillRect(-stats.bladeWidth, -1, stats.bladeWidth * 2, 3);
    }

    ctx.restore();
  }

  public drawConsumableStandalone(ctx: CanvasRenderingContext2D, x: number, y: number, consumableType: string, tier: number, bobY: number) {
    const img = itemImages.get(consumableType);
    if (img) {
      ctx.save();
      ctx.translate(x, y + bobY);
      ctx.shadowBlur = tier === 1 ? 6 : tier === 2 ? 12 : 20;
      ctx.shadowColor = tier === 3 ? "#c084fc" : tier === 2 ? "#fbbf24" : "#cbd5e1";
      ctx.drawImage(img, -16, -16, 32, 32);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(x, y + bobY);

    ctx.shadowBlur = tier === 1 ? 6 : tier === 2 ? 12 : 20;
    
    if (consumableType === "health_1") {
      ctx.shadowColor = "rgba(239, 68, 68, 0.8)";
      ctx.fillStyle = "#854d0e";
      ctx.fillRect(-3, -15, 6, 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(-2, -11, 4, 6);
      ctx.beginPath();
      ctx.arc(0, 0, 10, -Math.PI / 4, Math.PI * 5 / 4);
      ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    } else if (consumableType === "health_2") {
      ctx.shadowColor = "rgba(220, 38, 38, 1)";
      ctx.fillStyle = "#a16207";
      ctx.fillRect(-4, -18, 8, 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillRect(-3, -14, 6, 6);
      ctx.beginPath();
      ctx.moveTo(-12, 6);
      ctx.lineTo(-8, -8);
      ctx.lineTo(8, -8);
      ctx.lineTo(12, 6);
      ctx.lineTo(0, 14);
      ctx.closePath();
      ctx.fillStyle = "rgba(220, 38, 38, 0.95)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fbbf24";
      ctx.stroke();
    } else if (consumableType.startsWith("spelltome_")) {
      const subtype = consumableType.split("_")[1];
      ctx.shadowBlur = 12;
      ctx.shadowColor = subtype === "fire" ? "#f97316" :
                         subtype === "poison" ? "#22c55e" :
                         subtype === "frost" ? "#3b82f6" : "#fbbf24";
      ctx.fillStyle = subtype === "fire" ? "#ef4444" :
                      subtype === "poison" ? "#10b981" :
                      subtype === "frost" ? "#2563eb" : "#d97706";
      ctx.fillRect(-10, -12, 20, 24);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-10, -12, 20, 24);
      
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (consumableType === "ironskin") {
      ctx.shadowColor = "rgba(148, 163, 184, 0.9)";
      ctx.fillStyle = "#475569";
      ctx.fillRect(-4, -16, 8, 4);
      ctx.fillStyle = "#64748b";
      ctx.fillRect(-3, -12, 6, 6);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(10, -6);
      ctx.lineTo(8, 6);
      ctx.quadraticCurveTo(0, 12, 0, 15);
      ctx.quadraticCurveTo(0, 12, -8, 6);
      ctx.lineTo(-10, -6);
      ctx.closePath();
      ctx.fillStyle = "rgba(100, 116, 139, 0.9)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#e2e8f0";
      ctx.stroke();
    } else if (consumableType === "swiftness") {
      ctx.shadowColor = "rgba(34, 197, 94, 0.9)";
      ctx.fillStyle = "#854d0e";
      ctx.fillRect(-3, -17, 6, 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(-2, -13, 4, 6);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(9, 3);
      ctx.lineTo(0, 13);
      ctx.lineTo(-9, 3);
      ctx.closePath();
      ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#a7f3d0";
      ctx.stroke();
    } else if (consumableType === "spellbook") {
      ctx.shadowColor = "rgba(167, 139, 250, 1)";
      ctx.fillStyle = "#5b21b6";
      ctx.fillRect(-12, -10, 24, 18);
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-12, -10, 24, 18);
      ctx.fillStyle = "#f3e8ff";
      ctx.fillRect(-10, -8, 20, 2);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (consumableType === "energy") {
      ctx.shadowColor = "rgba(251, 191, 36, 0.9)";
      ctx.fillStyle = "#854d0e";
      ctx.fillRect(-3, -17, 6, 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(-2, -13, 4, 6);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(12, 10);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fillStyle = "rgba(251, 191, 36, 0.95)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }

    ctx.restore();
  }

  public drawPlayerVitalsUnderCharacter(ctx: CanvasRenderingContext2D) {
    const barW = 40;
    const startX = this.player.x + 30 - barW / 2;
    const startY = this.player.y + 68;

    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.fillRect(startX - 2, startY - 2, barW + 4, 10);

    // 1. HP Bar (Red)
    const hpPct = Math.max(0, this.player.Health) / 100;
    ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
    ctx.fillRect(startX, startY, barW, 3);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(startX, startY, barW * hpPct, 3);

    // 2. Energy Bar (Yellow)
    const energyPct = Math.max(0, this.player.Energy) / 100;
    ctx.fillStyle = "rgba(234, 179, 8, 0.3)";
    ctx.fillRect(startX, startY + 4, barW, 3);
    ctx.fillStyle = "#eab308";
    ctx.fillRect(startX, startY + 4, barW * energyPct, 3);

    ctx.restore();
  }

  public drawCanvasHUD(ctx: CanvasRenderingContext2D) {
    // 1. XP Bar (running along the very bottom of the canvas)
    ctx.save();
    const xpPct = Math.min(1.0, this.player.xp / this.player.xpNeeded);
    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.fillRect(0, MAP_HEIGHT - 6, MAP_WIDTH, 6);
    const xpGradient = ctx.createLinearGradient(0, MAP_HEIGHT - 6, MAP_WIDTH, MAP_HEIGHT - 6);
    xpGradient.addColorStop(0, "#8b5cf6");
    xpGradient.addColorStop(1, "#c084fc");
    ctx.fillStyle = xpGradient;
    ctx.fillRect(0, MAP_HEIGHT - 6, MAP_WIDTH * xpPct, 6);
    ctx.restore();

    // 2. Wave Info (Top Center)
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;

    if (this.wavePhase === "horde") {
      ctx.font = "36px 'VT323', monospace";
      ctx.fillStyle = "#f97316";
      ctx.strokeText(`WAVE ${this.waveNumber}`, MAP_WIDTH / 2, 15);
      ctx.fillText(`WAVE ${this.waveNumber}`, MAP_WIDTH / 2, 15);
      
      const remaining = this.waveTotalMobs - this.waveKilledMobs;
      ctx.font = "20px 'VT323', monospace";
      ctx.fillStyle = "#e2e8f0";
      ctx.strokeText(`${remaining} INVASION MOBS REMAINING`, MAP_WIDTH / 2, 50);
      ctx.fillText(`${remaining} INVASION MOBS REMAINING`, MAP_WIDTH / 2, 50);
    } else if (this.wavePhase === "prep") {
      ctx.font = "36px 'VT323', monospace";
      ctx.fillStyle = "#22c55e";
      ctx.strokeText("PREPARATION PHASE", MAP_WIDTH / 2, 15);
      ctx.fillText("PREPARATION PHASE", MAP_WIDTH / 2, 15);

      ctx.font = "20px 'VT323', monospace";
      if (this.prepTimerStarted) {
        const secondsLeft = (this.wavePrepTimer / 60).toFixed(1);
        ctx.fillStyle = "#f59e0b";
        ctx.strokeText(`NEXT INVASION IN ${secondsLeft}s`, MAP_WIDTH / 2, 50);
        ctx.fillText(`NEXT INVASION IN ${secondsLeft}s`, MAP_WIDTH / 2, 50);
      } else {
        ctx.fillStyle = "#a78bfa";
        ctx.strokeText("SHOP IS OPEN • TIMER STARTS AFTER LEAVING SHOP", MAP_WIDTH / 2, 50);
        ctx.fillText("SHOP IS OPEN • TIMER STARTS AFTER LEAVING SHOP", MAP_WIDTH / 2, 50);
      }
    }
    ctx.restore();

    // 3. Coins and Weapon (Top Right)
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(MAP_WIDTH - 210, 15, 195, 52, 8);
    ctx.fill();
    ctx.stroke();

    ctx.drawImage(assets.coin as HTMLImageElement, MAP_WIDTH - 198, 22, 18, 18);
    
    ctx.font = "bold 26px 'VT323', monospace";
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3.5;
    ctx.strokeText(this.player.Coin.toString(), MAP_WIDTH - 174, 32);
    ctx.fillText(this.player.Coin.toString(), MAP_WIDTH - 174, 32);

    ctx.font = "16px 'VT323', monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.strokeText("WEAPON:", MAP_WIDTH - 198, 50);
    ctx.fillText("WEAPON:", MAP_WIDTH - 198, 50);
    
    const hudWeaponImg = itemImages.get(this.player.currentWeapon);
    if (hudWeaponImg) {
      ctx.drawImage(hudWeaponImg as HTMLImageElement, MAP_WIDTH - 142, 42, 16, 16);
      ctx.font = "bold 18px 'VT323', monospace";
      ctx.fillStyle = "#f1f5f9";
      ctx.strokeText(this.player.currentWeapon, MAP_WIDTH - 122, 50);
      ctx.fillText(this.player.currentWeapon, MAP_WIDTH - 122, 50);
    } else {
      ctx.font = "bold 18px 'VT323', monospace";
      ctx.fillStyle = "#f1f5f9";
      ctx.strokeText(this.player.currentWeapon, MAP_WIDTH - 142, 50);
      ctx.fillText(this.player.currentWeapon, MAP_WIDTH - 142, 50);
    }
    ctx.restore();

    // 4. Level Badge (Top Left)
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(15, 15, 120, 52, 8);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;

    ctx.fillStyle = "#c084fc";
    ctx.font = "16px 'VT323', monospace";
    ctx.strokeText("LEVEL", 25, 27);
    ctx.fillText("LEVEL", 25, 27);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px 'VT323', monospace";
    ctx.strokeText(this.player.level.toString(), 25, 45);
    ctx.fillText(this.player.level.toString(), 25, 45);
    ctx.restore();

    // 5. Spell Tome Slots (Bottom Center)
    ctx.save();
    const slotW = 80;
    const slotH = 55;
    const spacing = 12;
    const totalSlotsW = 4 * slotW + 3 * spacing;
    const startSlotX = MAP_WIDTH / 2 - totalSlotsW / 2;
    const slotsY = MAP_HEIGHT - 70;

    const spellsInfo = [
      { key: "1", name: "Wrath", type: "aoe", imageKey: "spelltome_aoe", count: this.player.tomes.aoe, color: "#fbbf24", glow: "#fbbf24" },
      { key: "2", name: "Fire", type: "fire", imageKey: "spelltome_fire", count: this.player.tomes.fire, color: "#f97316", glow: "#f97316" },
      { key: "3", name: "Poison", type: "poison", imageKey: "spelltome_poison", count: this.player.tomes.poison, color: "#22c55e", glow: "#22c55e" },
      { key: "4", name: "Frost", type: "frost", imageKey: "spelltome_frost", count: this.player.tomes.frost, color: "#3b82f6", glow: "#3b82f6" }
    ];

    for (let i = 0; i < 4; i++) {
      const s = spellsInfo[i];
      const sx = startSlotX + i * (slotW + spacing);
      
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = s.count > 0 ? s.glow : "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = s.count > 0 ? 2 : 1.5;
      
      if (s.count > 0) {
        ctx.shadowColor = s.glow;
        ctx.shadowBlur = 8;
      }
      
      ctx.beginPath();
      ctx.roundRect(sx, slotsY, slotW, slotH, 6);
      ctx.fill();
      ctx.shadowBlur = 0; // reset shadow
      ctx.stroke();

      if (s.count === 0) {
        ctx.globalAlpha = 0.4;
      }

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 12px 'VT323', monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`[${s.key}]`, sx + 6, slotsY + 5);

      ctx.fillStyle = s.count > 0 ? "#f1f5f9" : "#64748b";
      ctx.font = "14px 'VT323', monospace";
      ctx.fillText(s.name, sx + 26, slotsY + 5);

      const tImg = itemImages.get(s.imageKey);
      if (tImg) {
        ctx.drawImage(tImg as HTMLImageElement, sx + 8, slotsY + 26, 20, 20);
      } else {
        ctx.fillStyle = s.color;
        ctx.fillRect(sx + 8, slotsY + 26, 20, 20);
      }

      ctx.fillStyle = s.count > 0 ? s.color : "#64748b";
      ctx.font = "bold 20px 'VT323', monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(`x${s.count}`, sx + slotW - 8, slotsY + slotH - 4);
      ctx.fillText(`x${s.count}`, sx + slotW - 8, slotsY + slotH - 4);

      ctx.restore();
    }
    ctx.restore();
  }

  public generateObstacles(): void {
    this.obstacles = [];
    const numObstacles = 12 + Math.floor(Math.random() * 8);
    const types: ("rock" | "tombstone" | "shrub")[] = ["rock", "tombstone", "shrub"];

    for (let i = 0; i < numObstacles; i++) {
      let attempts = 0;
      while (attempts < 100) {
        const rx = 50 + Math.random() * (MAP_WIDTH - 100);
        const ry = 50 + Math.random() * (MAP_HEIGHT - 100);
        const type = types[Math.floor(Math.random() * types.length)];

        const distToCenter = Math.sqrt((rx - 640) * (rx - 640) + (ry - 400) * (ry - 400));
        if (distToCenter < 180) {
          attempts++;
          continue;
        }

        let overlapping = false;
        const radius = type === "rock" ? 18 : type === "tombstone" ? 14 : 16;
        for (const obs of this.obstacles) {
          const dx = rx - obs.x;
          const dy = ry - obs.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < radius + obs.radius + 35) {
            overlapping = true;
            break;
          }
        }

        if (overlapping) {
          attempts++;
          continue;
        }

        let color = "#64748b";
        let outlineColor = "#334155";

        if (this.currentBiome === "grass") {
          if (type === "shrub") {
            color = "#15803d";
            outlineColor = "#14532d";
          } else if (type === "tombstone") {
            color = "#94a3b8";
            outlineColor = "#475569";
          }
        } else if (this.currentBiome === "desert") {
          if (type === "rock") {
            color = "#d97706";
            outlineColor = "#78350f";
          } else if (type === "shrub") {
            color = "#16a34a"; // cactus base
            outlineColor = "#166534";
          } else {
            color = "#b45309"; // tumbleweed
            outlineColor = "#78350f";
          }
        } else if (this.currentBiome === "tundra") {
          if (type === "rock") {
            color = "#cbd5e1";
            outlineColor = "#475569";
          } else if (type === "shrub") {
            color = "#0f766e";
            outlineColor = "#115e59";
          } else {
            color = "#e0f2fe"; // ice block
            outlineColor = "#0284c7";
          }
        } else if (this.currentBiome === "lava") {
          if (type === "rock") {
            color = "#1e1b4b"; // obsidian
            outlineColor = "#090514";
          } else if (type === "shrub") {
            color = "#ea580c"; // magma
            outlineColor = "#7c2d12";
          } else {
            color = "#e2e8f0"; // bone pile
            outlineColor = "#475569";
          }
        }

        this.obstacles.push({
          x: rx,
          y: ry,
          radius,
          type,
          color,
          outlineColor,
          size: 10 + Math.floor(Math.random() * 10)
        });
        break;
      }
    }
  }

  public drawSingleObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
    ctx.save();
      
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(obs.x, obs.y + obs.radius * 0.4, obs.radius * 1.1, obs.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    let spriteKey = "";
    if (this.currentBiome === "grass") {
      spriteKey = `grass_${obs.type}`;
    } else if (this.currentBiome === "desert") {
      if (obs.type === "shrub") {
        spriteKey = "desert_cactus";
      } else if (obs.type === "tombstone") {
        spriteKey = "desert_tumbleweed";
      } else {
        spriteKey = "desert_rock";
      }
    } else if (this.currentBiome === "tundra") {
      if (obs.type === "shrub") {
        spriteKey = "tundra_pine";
      } else if (obs.type === "tombstone") {
        spriteKey = "tundra_ice";
      } else {
        spriteKey = "tundra_rock";
      }
    } else if (this.currentBiome === "lava") {
      if (obs.type === "shrub") {
        spriteKey = "lava_magma";
      } else if (obs.type === "tombstone") {
        spriteKey = "lava_bones";
      } else {
        spriteKey = "lava_obsidian";
      }
    }

    const img = biomeImages.get(spriteKey);
    if (img) {
      let drawY = obs.y;
      let drawH = obs.radius * 2;
      if (spriteKey === "tundra_pine" || spriteKey === "grass_shrub") {
        drawY = obs.y - obs.radius * 0.4;
        drawH = obs.radius * 2.8;
      } else if (spriteKey === "desert_cactus") {
        drawY = obs.y - obs.radius * 0.3;
        drawH = obs.radius * 2.6;
      }
      ctx.drawImage(img as HTMLImageElement, obs.x - obs.radius, drawY - obs.radius, obs.radius * 2, drawH);
      ctx.restore();
      return;
    }

    ctx.fillStyle = obs.color;
    ctx.strokeStyle = obs.outlineColor;
    ctx.lineWidth = 2.5;

    if (obs.type === "shrub") {
      ctx.beginPath();
      ctx.arc(obs.x, obs.y - 4, obs.radius * 0.7, 0, Math.PI * 2);
      ctx.arc(obs.x - obs.radius * 0.5, obs.y + 2, obs.radius * 0.6, 0, Math.PI * 2);
      ctx.arc(obs.x + obs.radius * 0.5, obs.y + 2, obs.radius * 0.6, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      if (this.currentBiome === "grass") {
        ctx.fillStyle = "#22c55e";
        ctx.beginPath();
        ctx.arc(obs.x - 2, obs.y - 5, 2, 0, Math.PI * 2);
        ctx.arc(obs.x + 4, obs.y + 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.currentBiome === "desert") {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        const spines = [
          [obs.x, obs.y - 12], [obs.x - 5, obs.y - 8], [obs.x + 5, obs.y - 8],
          [obs.x - obs.radius * 0.5, obs.y - 3], [obs.x - obs.radius * 0.8, obs.y + 3],
          [obs.x + obs.radius * 0.5, obs.y - 3], [obs.x + obs.radius * 0.8, obs.y + 3]
        ];
        for (const [sx, sy] of spines) {
          ctx.beginPath();
          ctx.moveTo(sx - 2, sy - 2);
          ctx.lineTo(sx + 2, sy + 2);
          ctx.moveTo(sx + 2, sy - 2);
          ctx.lineTo(sx - 2, sy + 2);
          ctx.stroke();
        }
      }
    } else if (obs.type === "rock") {
      ctx.beginPath();
      const r = obs.radius;
      ctx.moveTo(obs.x - r, obs.y + r * 0.3);
      ctx.lineTo(obs.x - r * 0.6, obs.y - r * 0.8);
      ctx.lineTo(obs.x + r * 0.4, obs.y - r);
      ctx.lineTo(obs.x + r, obs.y - r * 0.2);
      ctx.lineTo(obs.x + r * 0.7, obs.y + r * 0.7);
      ctx.lineTo(obs.x - r * 0.5, obs.y + r * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.beginPath();
      ctx.moveTo(obs.x - r * 0.6, obs.y - r * 0.8);
      ctx.lineTo(obs.x, obs.y);
      ctx.lineTo(obs.x - r * 0.5, obs.y + r * 0.9);
      ctx.moveTo(obs.x, obs.y);
      ctx.lineTo(obs.x + r, obs.y - r * 0.2);
      ctx.stroke();
    } else if (obs.type === "tombstone") {
      if (this.currentBiome === "desert") {
        const r = obs.radius;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          ctx.arc(obs.x + (Math.random() - 0.5) * 6, obs.y + (Math.random() - 0.5) * 6, r * (0.4 + Math.random() * 0.4), 0, Math.PI * 2);
        }
        ctx.stroke();
      } else if (this.currentBiome === "tundra") {
        const r = obs.radius;
        ctx.beginPath();
        ctx.moveTo(obs.x - r, obs.y + r * 0.4);
        ctx.lineTo(obs.x - r * 0.3, obs.y - r);
        ctx.lineTo(obs.x + r, obs.y - r * 0.4);
        ctx.lineTo(obs.x + r * 0.3, obs.y + r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(obs.x - r * 0.3, obs.y - r);
        ctx.lineTo(obs.x - r * 0.3, obs.y + r);
        ctx.lineTo(obs.x + r * 0.3, obs.y + r);
        ctx.stroke();
      } else if (this.currentBiome === "lava") {
        const r = obs.radius;
        ctx.save();
        ctx.translate(obs.x, obs.y);
        for (let rot of [-Math.PI / 4, Math.PI / 4]) {
          ctx.save();
          ctx.rotate(rot);
          ctx.fillRect(-r, -2, r * 2, 4);
          ctx.beginPath();
          ctx.arc(-r, -3, 3, 0, Math.PI * 2);
          ctx.arc(-r, 3, 3, 0, Math.PI * 2);
          ctx.arc(r, -3, 3, 0, Math.PI * 2);
          ctx.arc(r, 3, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(0, -3, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = obs.outlineColor;
        ctx.fillRect(-3, 3, 6, 4);
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(-2, -4, 1.5, 1.5);
        ctx.fillRect(1, -4, 1.5, 1.5);
        ctx.restore();
      } else {
        const r = obs.radius;
        ctx.beginPath();
        ctx.moveTo(obs.x - r * 0.8, obs.y + r);
        ctx.lineTo(obs.x - r * 0.8, obs.y - r * 0.3);
        ctx.arcTo(obs.x - r * 0.8, obs.y - r, obs.x, obs.y - r, r * 0.8);
        ctx.arcTo(obs.x + r * 0.8, obs.y - r, obs.x + r * 0.8, obs.y - r * 0.3, r * 0.8);
        ctx.lineTo(obs.x + r * 0.8, obs.y + r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "rgba(30, 41, 59, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - r * 0.3);
        ctx.lineTo(obs.x, obs.y + r * 0.3);
        ctx.moveTo(obs.x - r * 0.3, obs.y - r * 0.1);
        ctx.lineTo(obs.x + r * 0.3, obs.y - r * 0.1);
        ctx.stroke();
      }
    }
    
    ctx.restore();
  }

  public resolveObstaclesCollisionX(entity: { x: number, y: number, speedX: number }, radius: number) {
    const cx = entity.x + 29;
    const cy = entity.y + 59;
    
    for (const obs of this.obstacles) {
      const dx = cx - obs.x;
      const dy = cy - obs.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = obs.radius + radius;
      
      if (dist < minDist) {
        const targetDx = Math.sqrt(minDist * minDist - dy * dy);
        if (dx > 0) {
          entity.x = obs.x + targetDx - 29;
        } else if (dx < 0) {
          entity.x = obs.x - targetDx - 29;
        }
        entity.speedX = 0;
      }
    }
  }

  public resolveObstaclesCollisionY(entity: { x: number, y: number, speedY: number }, radius: number) {
    const cx = entity.x + 29;
    const cy = entity.y + 59;
    
    for (const obs of this.obstacles) {
      const dx = cx - obs.x;
      const dy = cy - obs.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = obs.radius + radius;
      
      if (dist < minDist) {
        const targetDy = Math.sqrt(minDist * minDist - dx * dx);
        if (dy > 0) {
          entity.y = obs.y + targetDy - 59;
        } else if (dy < 0) {
          entity.y = obs.y - targetDy - 59;
        }
        entity.speedY = 0;
      }
    }
  }

  public resolveObstaclesCollisionAll(entity: Mob, radius: number) {
    const cx = entity.x + 29;
    const cy = entity.y + 59;
    
    for (const obs of this.obstacles) {
      const dx = cx - obs.x;
      const dy = cy - obs.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = obs.radius + radius;
      
      if (dist < minDist) {
        if (dist > 0) {
          const pushX = (dx / dist) * (minDist - dist);
          const pushY = (dy / dist) * (minDist - dist);
          entity.x += pushX;
          entity.y += pushY;
        }
      }
    }
  }

  public drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  public drawGame() {
    if (!this.gameStarted) return;
    this.ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    if (this.shopping) {
      // --- DRAW SHOP INTERIOR ---
      this.ctx.fillStyle = "#090d16";
      this.ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      this.ctx.drawImage(assets.insideShop as HTMLImageElement, 240, 0, 800, 800);

      this.ctx.fillStyle = "#1e293b";
      this.ctx.fillRect(230, 0, 10, 800);
      this.ctx.fillRect(1040, 0, 10, 800);

      const torchYPositions = [200, 500];
      for (const ty of torchYPositions) {
        const flickerRadius = 25 + Math.sin(this.gameCounter * 0.15) * 4 + Math.random() * 2;
        
        const leftGlow = this.ctx.createRadialGradient(245, ty, 2, 245, ty, flickerRadius);
        leftGlow.addColorStop(0, "rgba(253, 186, 116, 1)");
        leftGlow.addColorStop(0.5, "rgba(249, 115, 22, 0.4)");
        leftGlow.addColorStop(1, "rgba(249, 115, 22, 0)");
        this.ctx.fillStyle = leftGlow;
        this.ctx.beginPath();
        this.ctx.arc(245, ty, flickerRadius, 0, Math.PI * 2);
        this.ctx.fill();

        const rightGlow = this.ctx.createRadialGradient(1035, ty, 2, 1035, ty, flickerRadius);
        rightGlow.addColorStop(0, "rgba(253, 186, 116, 1)");
        rightGlow.addColorStop(0.5, "rgba(249, 115, 22, 0.4)");
        rightGlow.addColorStop(1, "rgba(249, 115, 22, 0)");
        this.ctx.fillStyle = rightGlow;
        this.ctx.beginPath();
        this.ctx.arc(1035, ty, flickerRadius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = "#334155";
        this.ctx.fillRect(235, ty - 8, 10, 16);
        this.ctx.fillRect(1035, ty - 8, 10, 16);
        this.ctx.fillStyle = "#ea580c";
        this.ctx.fillRect(242, ty - 12, 6, 8);
        this.ctx.fillRect(1032, ty - 12, 6, 8);
      }

      this.ctx.fillStyle = "rgba(153, 27, 27, 0.6)";
      this.ctx.fillRect(580, 680, 120, 120);
      this.ctx.strokeStyle = "rgba(217, 119, 6, 0.8)";
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(582, 680, 116, 120);

      // 3. Draw Pedestals and interactive items
      for (const stand of this.shopStands) {
        const item = stand.item;
        if (!item) continue;

        this.ctx.save();
        const glowRadius = 50 + Math.sin(this.gameCounter * 0.08) * 5;
        const pedestalGlow = this.ctx.createRadialGradient(stand.x, stand.y + 15, 5, stand.x, stand.y + 15, glowRadius);
        
        if (!item.purchased) {
          pedestalGlow.addColorStop(0, "rgba(96, 165, 250, 0.45)");
          pedestalGlow.addColorStop(0.5, "rgba(59, 130, 246, 0.18)");
          pedestalGlow.addColorStop(1, "rgba(59, 130, 246, 0)");
        } else {
          pedestalGlow.addColorStop(0, "rgba(239, 68, 68, 0.15)");
          pedestalGlow.addColorStop(1, "rgba(239, 68, 68, 0)");
        }
        this.ctx.fillStyle = pedestalGlow;
        this.ctx.beginPath();
        this.ctx.arc(stand.x, stand.y + 15, glowRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        const colGradient = this.ctx.createLinearGradient(stand.x - 20, stand.y, stand.x + 20, stand.y);
        colGradient.addColorStop(0, "#1e293b");
        colGradient.addColorStop(0.5, "#475569");
        colGradient.addColorStop(1, "#0f172a");
        this.ctx.fillStyle = colGradient;
        this.ctx.strokeStyle = "#64748b";
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(stand.x - 20, stand.y - 10, 40, 50);
        this.ctx.strokeRect(stand.x - 20, stand.y - 10, 40, 50);

        const rimGradient = this.ctx.createLinearGradient(stand.x - 24, stand.y - 18, stand.x + 24, stand.y - 18);
        rimGradient.addColorStop(0, "#334155");
        rimGradient.addColorStop(0.5, "#94a3b8");
        rimGradient.addColorStop(1, "#1e293b");
        this.ctx.fillStyle = rimGradient;
        this.ctx.fillRect(stand.x - 24, stand.y - 18, 48, 8);
        this.ctx.strokeRect(stand.x - 24, stand.y - 18, 48, 8);

        if (!item.purchased) {
          const bobY = Math.sin(this.gameCounter * 0.05) * 6;
          
          if (item.type === "weapon") {
            const rotationAngle = Math.sin(this.gameCounter * 0.03) * 0.3 - Math.PI / 4;
            this.drawWeaponStandalone(this.ctx, stand.x, stand.y - 38 + bobY, item.weaponType!, rotationAngle, 1.25);
          } else {
            this.drawConsumableStandalone(this.ctx, stand.x, stand.y - 38, item.consumableType!, item.tier, bobY);
          }

          this.ctx.save();
          this.ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
          this.ctx.strokeStyle = "#fbbf24";
          this.ctx.lineWidth = 1;
          
          const priceLabel = `${item.cost}`;
          this.ctx.font = "18px 'VT323', monospace";
          const textWidth = this.ctx.measureText(priceLabel).width;
          const badgeW = textWidth + 30;
          const badgeH = 20;
          const badgeX = stand.x - badgeW / 2;
          const badgeY = stand.y + 48;

          this.ctx.beginPath();
          this.ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.drawImage(assets.coin as HTMLImageElement, badgeX + 6, badgeY + 3, 14, 14);

          this.ctx.fillStyle = "#fbbf24";
          this.ctx.textAlign = "left";
          this.ctx.textBaseline = "middle";
          this.ctx.fillText(priceLabel, badgeX + 24, badgeY + badgeH / 2 + 1);
          this.ctx.restore();

          this.ctx.save();
          this.ctx.fillStyle = item.tier === 3 ? "#c084fc" : item.tier === 2 ? "#fbbf24" : "#cbd5e1";
          this.ctx.strokeStyle = "#000000";
          this.ctx.lineWidth = 2;

          const starCount = item.tier;
          const starSpacing = 16;
          const totalW = (starCount - 1) * starSpacing;
          const startStarX = stand.x - totalW / 2;
          const starY = stand.y - 65;

          for (let s = 0; s < starCount; s++) {
            this.ctx.save();
            this.ctx.translate(startStarX + s * starSpacing, starY);
            this.ctx.scale(1.1, 0.8);
            this.drawStar(this.ctx, 0, 0, 5, 8, 3.5);
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.restore();
          }

          this.ctx.font = "18px 'VT323', monospace";
          this.ctx.fillStyle = "#e2e8f0";
          this.ctx.strokeStyle = "#000000";
          this.ctx.lineWidth = 3;
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.strokeText(item.name, stand.x, stand.y - 82);
          this.ctx.fillText(item.name, stand.x, stand.y - 82);
          this.ctx.restore();

        } else {
          this.ctx.save();
          this.ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
          this.ctx.strokeStyle = "#ef4444";
          this.ctx.lineWidth = 1;

          this.ctx.font = "16px 'VT323', monospace";
          const badgeW = 60;
          const badgeH = 18;
          const badgeX = stand.x - badgeW / 2;
          const badgeY = stand.y - 32;

          this.ctx.beginPath();
          this.ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.fillStyle = "#ffffff";
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.fillText("SOLD OUT", stand.x, badgeY + badgeH / 2 + 1);
          this.ctx.restore();
        }
      }

      this.player.draw(this.ctx, itemImages);
      this.drawPlayerVitalsUnderCharacter(this.ctx);

    } else {
      // --- DRAW OVERWORLD ---
      let bgCanvas: HTMLCanvasElement | null = null;
      if (this.currentBiome === "desert") {
        bgCanvas = this.sandPattern;
      } else if (this.currentBiome === "tundra") {
        bgCanvas = this.snowPattern;
      } else if (this.currentBiome === "lava") {
        bgCanvas = this.lavaPattern;
      }

      if (bgCanvas) {
        this.ctx.drawImage(bgCanvas, 0, 0);
      } else {
        const grassPattern = this.ctx.createPattern(assets.grass, "repeat");
        if (grassPattern) {
          this.ctx.fillStyle = grassPattern;
          this.ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
        } else {
          this.ctx.fillStyle = "#14532d";
          this.ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
        }
      }

      if (this.biomeOverlayCanvas) {
        this.ctx.drawImage(this.biomeOverlayCanvas, 0, 0);
      }

      if (this.currentBiome === "lava") {
        this.ctx.save();
        const pulse1 = 0.12 + Math.sin(this.gameCounter * 0.015) * 0.04;
        if (this.lavaGlow1Canvas) {
          this.ctx.globalAlpha = pulse1;
          this.ctx.drawImage(this.lavaGlow1Canvas, 400 - 400, 300 - 400);
        }

        const pulse2 = 0.10 + Math.cos(this.gameCounter * 0.02) * 0.03;
        if (this.lavaGlow2Canvas) {
          this.ctx.globalAlpha = pulse2;
          this.ctx.drawImage(this.lavaGlow2Canvas, 900 - 350, 500 - 350);
        }
        this.ctx.restore();
      } else if (this.currentBiome === "tundra") {
        this.ctx.save();
        const shimmer = 0.04 + Math.sin(this.gameCounter * 0.012) * 0.025;
        this.ctx.fillStyle = `rgba(186, 230, 253, ${shimmer})`;
        this.ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
        this.ctx.restore();
      } else if (this.currentBiome === "desert") {
        this.ctx.save();
        const wash = 0.03 + Math.sin(this.gameCounter * 0.008) * 0.02;
        this.ctx.fillStyle = `rgba(251, 191, 36, ${wash})`;
        this.ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
        this.ctx.restore();
      }

      this.drawFloorDecals(this.ctx);
      this.drawDamagePuddles(this.ctx);
      this.drawTeleportPortal(this.ctx);

      for (const wave of this.shockwaves) {
        wave.draw(this.ctx);
      }

      for (const drop of this.lootDrops) {
        drop.draw(this.ctx, itemImages, this.gameCounter);
      }

      for (const coin of this.coinDrops) {
        coin.draw(this.ctx, this.gameCounter);
      }

      interface YSortable {
        ySort: number;
        draw: () => void;
      }
      const renderList: YSortable[] = [];

      if (this.resonator && this.resonator.health > 0) {
        renderList.push({
          ySort: this.resonator.y + 14,
          draw: () => this.resonator!.draw(this.ctx, this.gameCounter, this.currentBiome)
        });
      }

      if (this.player.visible) {
        renderList.push({
          ySort: this.player.y + 59,
          draw: () => {
            this.player.draw(this.ctx, itemImages);
            this.drawPlayerVitalsUnderCharacter(this.ctx);
          }
        });
      }

      for (const mob of this.mobs) {
        if (mob.visible) {
          renderList.push({
            ySort: mob.y + 59,
            draw: () => mob.draw(this.ctx)
          });
        }
      }

      for (const obs of this.obstacles) {
        renderList.push({
          ySort: obs.y,
          draw: () => this.drawSingleObstacle(this.ctx, obs)
        });
      }

      renderList.sort((a, b) => a.ySort - b.ySort);

      for (const item of renderList) {
        item.draw();
      }

      for (const proj of this.spellProjectiles) {
        proj.draw(this.ctx);
      }

      for (const bone of this.enemyProjectiles) {
        bone.draw(this.ctx, this.gameCounter);
      }

      // Draw Swarm Incursion warning indicators
      if (this.incursionWarningTimer > 0 && this.activeIncursionDirection !== null) {
        if (this.gameCounter % 20 < 10) {
          this.ctx.save();
          
          let ax = 0;
          let ay = 0;
          let angle = 0;
          
          if (this.activeIncursionDirection === "top") {
            ax = MAP_WIDTH / 2;
            ay = 50;
            angle = -Math.PI / 2;
          } else if (this.activeIncursionDirection === "bottom") {
            ax = MAP_WIDTH / 2;
            ay = MAP_HEIGHT - 50;
            angle = Math.PI / 2;
          } else if (this.activeIncursionDirection === "left") {
            ax = 50;
            ay = MAP_HEIGHT / 2;
            angle = Math.PI;
          } else if (this.activeIncursionDirection === "right") {
            ax = MAP_WIDTH - 50;
            ay = MAP_HEIGHT / 2;
            angle = 0;
          }
          
          this.ctx.translate(ax, ay);
          this.ctx.rotate(angle);
          
          this.ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
          this.ctx.strokeStyle = "#ffffff";
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.moveTo(30, 0);
          this.ctx.lineTo(0, -25);
          this.ctx.lineTo(0, -10);
          this.ctx.lineTo(-40, -10);
          this.ctx.lineTo(-40, 10);
          this.ctx.lineTo(0, 10);
          this.ctx.lineTo(0, 25);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.fillStyle = "#ffffff";
          this.ctx.font = "bold 20px monospace";
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.fillText("!", -15, 0);
          
          this.ctx.restore();
          
          this.ctx.save();
          this.ctx.fillStyle = "#ef4444";
          this.ctx.font = "bold 56px 'VT323', monospace";
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.strokeStyle = "#000000";
          this.ctx.lineWidth = 6;
          this.ctx.strokeText("WARNING: SWARM INCOMING!", MAP_WIDTH / 2, MAP_HEIGHT / 2 - 150);
          this.ctx.fillText("WARNING: SWARM INCOMING!", MAP_WIDTH / 2, MAP_HEIGHT / 2 - 150);
          this.ctx.restore();
        }
      }
    }

    this.drawCanvasHUD(this.ctx);

    if (this.levelUpAlertTimer > 0) {
      this.ctx.save();
      this.ctx.fillStyle = "#a78bfa";
      this.ctx.font = "bold 64px 'VT323', monospace";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.strokeStyle = "#000000";
      this.ctx.lineWidth = 6;
      this.ctx.strokeText(this.levelUpAlertText, MAP_WIDTH / 2, MAP_HEIGHT / 2 - 80);
      this.ctx.fillText(this.levelUpAlertText, MAP_WIDTH / 2, MAP_HEIGHT / 2 - 80);
      this.ctx.restore();
    }

    if (this.shopAnnounceTimer > 0 && this.shopAnnounceMessage) {
      this.ctx.save();
      this.ctx.fillStyle = "#f59e0b";
      this.ctx.font = "bold 48px 'VT323', monospace";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.strokeStyle = "#000000";
      this.ctx.lineWidth = 5;
      this.ctx.strokeText(this.shopAnnounceMessage, MAP_WIDTH / 2, MAP_HEIGHT / 2 + 100);
      this.ctx.fillText(this.shopAnnounceMessage, MAP_WIDTH / 2, MAP_HEIGHT / 2 + 100);
      this.ctx.restore();
    }

    // Draw Game Over overlay
    if (this.player.Health <= 0 || (this.resonator && this.resonator.health <= 0)) {
      this.ui.showGameOver(this.player.Coin, this.waveSpawnsTriggered, () => {
        sound.play("button");
        this.initGame();
      }, this.resonator ? this.resonator.health <= 0 : false);
    }
  }
}

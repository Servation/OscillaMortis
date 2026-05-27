import { Keyboard } from "./engine/Keyboard";
import { SoundManager } from "./engine/Sound";
import { UIManager } from "./components/UI";
import { Player, type WeaponType, WEAPON_STATS } from "./entities/Player";
import { Zombie, type ZombieType } from "./entities/Zombie";
import { checkRectCollision, checkCircleSquareCollision } from "./engine/Collision";
import "./style.css";

// Import extracted entities and interfaces
import { EnemyProjectile } from "./entities/EnemyProjectile";
import { BiomeResonator } from "./entities/BiomeResonator";
import { LootDrop } from "./entities/LootDrop";
import { CoinDrop } from "./entities/CoinDrop";
import { SpellProjectile } from "./entities/SpellProjectile";
import { Shockwave } from "./entities/Shockwave";
import type { Obstacle, FloorDecal } from "./entities/Obstacle";
import type { ShopStand, ConsumableItem, WeaponItem } from "./entities/ShopItem";
import { WEAPON_ITEMS, CONSUMABLE_ITEMS } from "./entities/ShopItem";
import type { BuildingTiles } from "./entities/Building";

// Setup Canvas and Context
const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// Canvas coordinate dimensions
export const MAP_WIDTH = 1280;
export const MAP_HEIGHT = 800;
canvas.width = MAP_WIDTH;
canvas.height = MAP_HEIGHT;

// Core Engines & State
const keyboard = new Keyboard();
export const sound = new SoundManager();
const ui = new UIManager();


let lootDrops: LootDrop[] = [];
let spellProjectiles: SpellProjectile[] = [];
let shockwaves: Shockwave[] = [];

// Assets preloading and processing helper
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
}

function tryLoadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

const itemImages: Map<string, HTMLImageElement> = new Map();
const biomeImages: Map<string, HTMLImageElement> = new Map();

// Shader filter to replace solid backgrounds with transparency
function filterImageTransparency(img: HTMLImageElement): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const canvasTemp = document.createElement("canvas");
    canvasTemp.width = img.width;
    canvasTemp.height = img.height;
    const ctxTemp = canvasTemp.getContext("2d")!;
    ctxTemp.drawImage(img, 0, 0);

    const imgData = ctxTemp.getImageData(0, 0, canvasTemp.width, canvasTemp.height);
    const data = imgData.data;

    // Check if the image already has transparency.
    // If more than 3% of pixels have an alpha less than 100, we consider the image already transparent.
    let transparentPixelCount = 0;
    const totalPixels = canvasTemp.width * canvasTemp.height;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 100) {
        transparentPixelCount++;
      }
    }
    const alreadyTransparent = transparentPixelCount > (totalPixels * 0.03);

    if (!alreadyTransparent) {
      // Use the top-left pixel (0,0) as the background color
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];
      const bgA = data[3];

      if (bgA > 0) {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Euclidean distance in RGB color space
          const dist = Math.sqrt(
            (r - bgR) * (r - bgR) +
            (g - bgG) * (g - bgG) +
            (b - bgB) * (b - bgB)
          );
          
          // Also clear pixels close to pure white (since AI images often fade to white at borders)
          const distToWhite = Math.sqrt(
            (r - 255) * (r - 255) +
            (g - 255) * (g - 255) +
            (b - 255) * (b - 255)
          );

          // Calculate color difference to identify off-whites/greys (low saturation, high brightness)
          const maxVal = Math.max(r, g, b);
          const minVal = Math.min(r, g, b);
          const diff = maxVal - minVal;

          // Clear if close to background, close to white, or is highly bright but desaturated (grey halo)
          if (dist < 80 || distToWhite < 80 || (maxVal > 190 && diff < 20)) {
            data[i + 3] = 0; // Set alpha to 0 (transparent)
          }
        }
      }
    }

    ctxTemp.putImageData(imgData, 0, 0);
    const transparentImg = new Image();
    transparentImg.src = canvasTemp.toDataURL();
    transparentImg.onload = () => resolve(transparentImg);
  });
}

let floorDecals: FloorDecal[] = [];

// Game State Variables
let player: Player;
let zombies: Zombie[] = [];
let enemyProjectiles: EnemyProjectile[] = [];
const PORTAL_X = 640;
const PORTAL_Y = 280;
let resonator: BiomeResonator | null = null;
let coinDrops: CoinDrop[] = [];
let obstacles: Obstacle[] = [];
type BiomeType = "grass" | "desert" | "tundra" | "lava";
let currentBiome: BiomeType = "grass";
let sandPattern: HTMLCanvasElement | null = null;
let snowPattern: HTMLCanvasElement | null = null;
let lavaPattern: HTMLCanvasElement | null = null;
let biomeOverlayCanvas: HTMLCanvasElement | null = null;
let lavaGlow1Canvas: HTMLCanvasElement | null = null;
let lavaGlow2Canvas: HTMLCanvasElement | null = null;

let runnerSheet: HTMLCanvasElement;
let ghostSheet: HTMLCanvasElement;
let skeletonSheet: HTMLCanvasElement;
let bruteSheet: HTMLCanvasElement;

function generateFloorDecals(): void {
  floorDecals = [];
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

    floorDecals.push({
      x: rx,
      y: ry,
      size: 4 + Math.floor(Math.random() * 12),
      type: Math.floor(Math.random() * 3)
    });
  }
}

function drawFloorDecals(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  for (const d of floorDecals) {
    if (currentBiome === "grass") {
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
    } else if (currentBiome === "desert") {
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
    } else if (currentBiome === "tundra") {
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
    } else if (currentBiome === "lava") {
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

function generateProceduralBackgrounds() {
  // 1. Sand / Desert (1280x800)
  const sandCanvas = document.createElement("canvas");
  sandCanvas.width = MAP_WIDTH;
  sandCanvas.height = MAP_HEIGHT;
  const sCtx = sandCanvas.getContext("2d")!;
  const sandImg = biomeImages.get("desert_floor");
  if (sandImg) {
    sCtx.drawImage(sandImg, 0, 0, MAP_WIDTH, MAP_HEIGHT);
  } else {
    // Fallback if image fails to load
    sCtx.fillStyle = "#fef08a";
    sCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  }
  sandPattern = sandCanvas;

  // 2. Snow / Tundra (1280x800)
  const snowCanvas = document.createElement("canvas");
  snowCanvas.width = MAP_WIDTH;
  snowCanvas.height = MAP_HEIGHT;
  const snCtx = snowCanvas.getContext("2d")!;
  const snowImg = biomeImages.get("tundra_floor");
  if (snowImg) {
    snCtx.drawImage(snowImg, 0, 0, MAP_WIDTH, MAP_HEIGHT);
  } else {
    // Fallback
    snCtx.fillStyle = "#f1f5f9";
    snCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  }
  snowPattern = snowCanvas;

  // 3. Lava Field (1280x800)
  const lavaCanvas = document.createElement("canvas");
  lavaCanvas.width = MAP_WIDTH;
  lavaCanvas.height = MAP_HEIGHT;
  const lCtx = lavaCanvas.getContext("2d")!;
  const lavaImg = biomeImages.get("lava_floor");
  if (lavaImg) {
    lCtx.drawImage(lavaImg, 0, 0, MAP_WIDTH, MAP_HEIGHT);
  } else {
    // Fallback
    lCtx.fillStyle = "#0c0a12";
    lCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  }
  lavaPattern = lavaCanvas;
}

function generateLavaGlowCanvases() {
  // Glow 1: Red radial glow, 800x800
  lavaGlow1Canvas = document.createElement("canvas");
  lavaGlow1Canvas.width = 800;
  lavaGlow1Canvas.height = 800;
  const ctx1 = lavaGlow1Canvas.getContext("2d")!;
  const grad1 = ctx1.createRadialGradient(400, 400, 50, 400, 400, 400);
  grad1.addColorStop(0, "rgba(239, 68, 68, 1)");
  grad1.addColorStop(1, "rgba(239, 68, 68, 0)");
  ctx1.fillStyle = grad1;
  ctx1.beginPath();
  ctx1.arc(400, 400, 400, 0, Math.PI * 2);
  ctx1.fill();

  // Glow 2: Orange radial glow, 700x700
  lavaGlow2Canvas = document.createElement("canvas");
  lavaGlow2Canvas.width = 700;
  lavaGlow2Canvas.height = 700;
  const ctx2 = lavaGlow2Canvas.getContext("2d")!;
  const grad2 = ctx2.createRadialGradient(350, 350, 100, 350, 350, 350);
  grad2.addColorStop(0, "rgba(249, 115, 22, 1)");
  grad2.addColorStop(1, "rgba(249, 115, 22, 0)");
  ctx2.fillStyle = grad2;
  ctx2.beginPath();
  ctx2.arc(350, 350, 350, 0, Math.PI * 2);
  ctx2.fill();
}

function generateBiomeOverlay(biome: BiomeType): void {
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

  biomeOverlayCanvas = overlayCanvas;
}

function setBiome(biome: BiomeType) {
  currentBiome = biome;
  sound.playAmbience(biome);



  generateBiomeOverlay(biome);
  generateObstacles();
  generateFloorDecals();
}

function selectRandomBiome() {
  const biomes: BiomeType[] = ["grass", "desert", "tundra", "lava"];
  const oldBiome = currentBiome;
  let next = oldBiome;
  while (next === oldBiome) {
    next = biomes[Math.floor(Math.random() * biomes.length)];
  }
  setBiome(next);
}

// Wave Loop Variables
let waveNumber = 1;
let wavePhase: "horde" | "prep" = "horde";
let waveTotalZombies = 5;
let waveSpawnsTriggered = 0;
let waveKilledZombies = 0;
let wavePrepTimer = 0; // Ticks countdown (45 seconds = 2700 ticks)
let prepTimerStarted = false;

// Swarm Incursion State
let activeIncursionDirection: "top" | "bottom" | "left" | "right" | null = null;
let incursionWarningTimer = 0;
let incursionSpawnsRemaining = 0;
let currentIncursionIndex = 0;
let incursionIntervalTimer = 0;

// Shop Interior Variables
let shopping = false;
let shopAnnounceMessage = "";
let shopAnnounceTimer = 0;

let gameStarted = false;
let gameCounter = 0;
let magicCooldown = 0;
let levelUpAlertText = "";
let levelUpAlertTimer = 0;

// Asset resources mapping
interface Assets {
  grass: HTMLImageElement;
  coin: HTMLImageElement;
  playerWalking: HTMLImageElement;
  playerKnife: HTMLImageElement;
  zombie: HTMLImageElement;
  insideShop: HTMLImageElement;
  buildingTiles: BuildingTiles;
  heartIcon: HTMLImageElement;
  lightningIcon: HTMLImageElement;
  strengthIcon: HTMLImageElement;
}

let assets: Assets;

function createTintedSheet(baseImg: HTMLImageElement, filterStr: string): HTMLCanvasElement {
  const canvasTemp = document.createElement("canvas");
  canvasTemp.width = baseImg.width;
  canvasTemp.height = baseImg.height;
  const ctxTemp = canvasTemp.getContext("2d")!;
  ctxTemp.save();
  ctxTemp.filter = filterStr;
  ctxTemp.drawImage(baseImg, 0, 0);
  ctxTemp.restore();
  return canvasTemp;
}

async function preloadAssets() {
  console.log("Preloading assets...");

  const grassImg = await loadImage("/assets/grass.png");
  // Load raw coin image and apply transparency shader filter
  const coinImgRaw = await loadImage("/assets/coin-131982518676438146_512.png");
  const coinImg = await filterImageTransparency(coinImgRaw);

  const playerWalkImg = await loadImage("/assets/playerwalking.png");
  const playerKnifeImg = await loadImage("/assets/pngfind.com-sprite-png-405863.png");
  const zombieImg = await loadImage("/assets/zombie.png");
  const insideShopImg = await loadImage("/assets/insideShop.png");

  // Upgrade icons
  const heartImg = await loadImage("/assets/icons8-heart-64.png");
  const lightningImg = await loadImage("/assets/icons8-lightning-bolt-80.png");
  const strengthImg = await loadImage("/assets/icons8-strength-100.png");

  // Building tiles mapping
  const buildingTiles: BuildingTiles = {
    roofback: await loadImage("/assets/rpgTile061.png"),
    roofBL: await loadImage("/assets/rpgTile148.png"),
    roofBR: await loadImage("/assets/rpgTile149.png"),
    frontL: await loadImage("/assets/rpgTile060.png"),
    frontR: await loadImage("/assets/rpgTile062.png"),
    door: await loadImage("/assets/rpgTile189.png"),
    window: await loadImage("/assets/rpgTile187.png"),
    roofTL: await loadImage("/assets/rpgTile112.png"),
    roofTR: await loadImage("/assets/rpgTile113.png"),
  };

  assets = {
    grass: grassImg,
    coin: coinImg,
    playerWalking: playerWalkImg,
    playerKnife: playerKnifeImg,
    zombie: zombieImg,
    insideShop: insideShopImg,
    buildingTiles,
    heartIcon: heartImg,
    lightningIcon: lightningImg,
    strengthIcon: strengthImg,
  };

  // Preload optional weapon assets
  const weaponFiles: Record<WeaponType, string> = {
    "Wooden Sword": "wooden_sword.png",
    "Short Sword": "short_sword.png",
    "Wooden Club": "wooden_club.png",
    "Iron Sword": "iron_sword.png",
    "Baseball Bat": "baseball_bat.png",
    "Machete": "machete.png",
    "Fire Axe": "fire_axe.png"
  };

  for (const [weaponName, filename] of Object.entries(weaponFiles)) {
    const imgRaw = await tryLoadImage(`/assets/${filename}`);
    if (imgRaw) {
      const img = await filterImageTransparency(imgRaw);
      itemImages.set(weaponName, img);
    }
  }

  // Preload optional consumable assets
  const consumableFiles = [
    { type: "health_1", file: "health_elixir.png" },
    { type: "health_2", file: "greater_health_elixir.png" },
    { type: "spelltome_aoe", file: "tome_wrath.png" },
    { type: "spelltome_fire", file: "tome_fire.png" },
    { type: "spelltome_poison", file: "tome_poison.png" },
    { type: "spelltome_frost", file: "tome_frost.png" },
    { type: "ironskin", file: "ironskin.png" },
    { type: "swiftness", file: "swiftness.png" },
    { type: "spellbook", file: "spellbook.png" },
    { type: "energy", file: "energy.png" }
  ];

  for (const item of consumableFiles) {
    const imgRaw = await tryLoadImage(`/assets/${item.file}`);
    if (imgRaw) {
      const img = await filterImageTransparency(imgRaw);
      itemImages.set(item.type, img);
    }
  }

  // Preload optional biome assets (floors and obstacles)
  const biomeFiles = [
    { key: "desert_floor", file: "desert_floor.jpg" },
    { key: "tundra_floor", file: "tundra_floor.jpg" },
    { key: "lava_floor", file: "lava_floor.jpg" },
    
    { key: "grass_shrub", file: "grass_shrub.png" },
    { key: "grass_rock", file: "grass_rock.png" },
    { key: "grass_tombstone", file: "grass_tombstone.png" },
    
    { key: "desert_cactus", file: "desert_cactus.png" },
    { key: "desert_rock", file: "desert_rock.png" },
    { key: "desert_tumbleweed", file: "desert_tumbleweed.png" },
    
    { key: "tundra_pine", file: "tundra_pine.png" },
    { key: "tundra_rock", file: "tundra_rock.png" },
    { key: "tundra_ice", file: "tundra_ice.png" },
    
    { key: "lava_magma", file: "lava_magma.png" },
    { key: "lava_obsidian", file: "lava_obsidian.png" },
    { key: "lava_bones", file: "lava_bones.png" }
  ];

  for (const b of biomeFiles) {
    const imgRaw = await tryLoadImage(`/assets/${b.file}`);
    if (imgRaw) {
      // Do not apply transparency filter to full-screen floor backgrounds
      const img = b.key.endsWith("_floor") ? imgRaw : await filterImageTransparency(imgRaw);
      biomeImages.set(b.key, img);
    }
  }

  // Preload sounds
  await sound.preload("knife", "/assets/568169__merrick079__sword-sound-2.wav");
  await sound.preload("zombie", "/assets/zombie.wav");
  await sound.preload("button", "/assets/Restart.wav");

  // Pre-render tinted sheets once to avoid game loop lag from ctx.filter
  runnerSheet = createTintedSheet(zombieImg, "hue-rotate(310deg) saturate(1.8) contrast(1.2)");
  ghostSheet = createTintedSheet(zombieImg, "hue-rotate(240deg) saturate(1.5) brightness(1.2)");
  skeletonSheet = createTintedSheet(zombieImg, "grayscale(1) brightness(1.6)");
  bruteSheet = createTintedSheet(zombieImg, "hue-rotate(120deg) saturate(1.2) brightness(0.8)");

  console.log("All assets loaded successfully.");
}

function initGame() {
  gameCounter = 0;
  magicCooldown = 0;
  shopping = false;
  shopAnnounceTimer = 0;
  levelUpAlertTimer = 0;

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

  for (const stand of shopStands) {
    stand.item = null;
  }

  // Wave initialization
  waveNumber = 1;
  wavePhase = "horde";
  waveTotalZombies = 0; // Will be set dynamically by incursions
  waveSpawnsTriggered = 0;
  waveKilledZombies = 0;
  wavePrepTimer = 0;
  prepTimerStarted = false;

  activeIncursionDirection = null;
  incursionWarningTimer = 0;
  incursionSpawnsRemaining = 0;
  currentIncursionIndex = 0;
  incursionIntervalTimer = 0;

  // Initialize Player
  player = new Player(
    assets.playerWalking,
    assets.playerKnife,
    MAP_WIDTH,
    MAP_HEIGHT
  );

  resonator = new BiomeResonator();



  // Set starting biome (grass)
  generateProceduralBackgrounds();
  generateLavaGlowCanvases();
  setBiome("grass");

  // Clear lists
  spellProjectiles = [];
  lootDrops = [];
  shockwaves = [];
  enemyProjectiles = [];
  coinDrops = [];
  zombies = [];
}

// Spawns a single zombie of appropriate type for the active wave from a specific direction
function spawnZombieFromDirection(dir: "top" | "bottom" | "left" | "right") {
  let spawnX = 0;
  let spawnY = 0;
  const offset = (Math.random() - 0.5) * 160;

  if (dir === "top") {
    spawnX = MAP_WIDTH / 2 + offset;
    spawnY = -25;
  } else if (dir === "bottom") {
    spawnX = MAP_WIDTH / 2 + offset;
    spawnY = MAP_HEIGHT + 15;
  } else if (dir === "right") {
    spawnX = MAP_WIDTH + 15;
    spawnY = MAP_HEIGHT / 2 + offset;
  } else { // left
    spawnX = -15;
    spawnY = MAP_HEIGHT / 2 + offset;
  }

  // Difficulty Type Distribution based on wave progress
  let type: ZombieType = "walker";
  const roll = Math.random();

  if (waveNumber === 1) {
    // Wave 1: Only Slimes
    type = "slime";
  } else if (waveNumber === 2) {
    // Wave 2: Slimes (50%) + Walkers (50%)
    type = roll < 0.50 ? "slime" : "walker";
  } else if (waveNumber === 3) {
    // Wave 3: Walkers (50%) + Runners (30%) + Slimes (20%)
    if (roll < 0.20) type = "slime";
    else if (roll < 0.50) type = "runner";
    else type = "walker";
  } else if (waveNumber === 4) {
    // Wave 4: Walkers (30%) + Runners (30%) + Skeletons (20%) + Ghosts (20%)
    if (roll < 0.20) type = "ghost";
    else if (roll < 0.40) type = "skeleton";
    else if (roll < 0.70) type = "runner";
    else type = "walker";
  } else {
    // Wave 5+: All mobs mixed: Walkers (20%), Runners (25%), Skeletons (15%), Ghosts (15%), Slimes (10%), Brutes (15%)
    if (roll < 0.10) type = "slime";
    else if (roll < 0.25) type = "skeleton";
    else if (roll < 0.40) type = "ghost";
    else if (roll < 0.55) type = "brute";
    else if (roll < 0.80) type = "runner";
    else type = "walker";
  }

  let zSheet: HTMLImageElement | HTMLCanvasElement = assets.zombie;
  if (type === "runner") zSheet = runnerSheet;
  else if (type === "ghost") zSheet = ghostSheet;
  else if (type === "skeleton") zSheet = skeletonSheet;
  else if (type === "brute") zSheet = bruteSheet;

  const z = new Zombie(zSheet, MAP_WIDTH, MAP_HEIGHT, spawnX, spawnY, type);
  // Default target: 70% resonator, 30% player
  z.aggroTarget = Math.random() < 0.70 ? "resonator" : "player";

  zombies.push(z);
  waveSpawnsTriggered += 1;
}

// Trigger player level up indicator
function handlePlayerLevelUp(newLvl: number) {
  sound.play("button");
  levelUpAlertText = `LEVEL UP! LEVEL ${newLvl}`;
  levelUpAlertTimer = 120; // Show for 2 seconds (120 frames)
}

// Shared Zombie Death Handler (handles splitting slimes, XP, coins, and spell drops)
function handleZombieDeath(zombie: Zombie) {
  zombie.visible = false;
  waveKilledZombies += 1;
  
  // Coin rewards
  const numCoins = Math.floor(Math.random() * (zombie.coinRewardMax - zombie.coinRewardMin + 1)) + zombie.coinRewardMin;
  const cx = zombie.x + zombie.width / 2;
  const cy = zombie.y + zombie.height / 2;
  for (let i = 0; i < numCoins; i++) {
    coinDrops.push(new CoinDrop(cx, cy, 1));
  }

  // 10% chance to drop a random spell book
  if (Math.random() < 0.10) {
    const spellTypes: ("aoe" | "fire" | "poison" | "frost")[] = ["aoe", "fire", "poison", "frost"];
    const chosenType = spellTypes[Math.floor(Math.random() * spellTypes.length)];
    lootDrops.push(new LootDrop(cx, cy, chosenType));
  }

  // 5% chance to drop a health or energy potion on the ground
  if (Math.random() < 0.05) {
    const potionType = Math.random() < 0.5 ? "health" : "energy";
    lootDrops.push(new LootDrop(cx, cy, potionType));
  }

  // XP progression values
  let xpVal = 10;
  if (zombie.zombieType === "brute") xpVal = 30;
  else if (zombie.zombieType === "runner" || zombie.zombieType === "ghost" || zombie.zombieType === "skeleton") xpVal = 15;
  else if (zombie.zombieType === "slime") xpVal = 12;
  else if (zombie.zombieType === "minislime") xpVal = 5;

  player.addXP(xpVal, handlePlayerLevelUp);

  // Slime splitting logic
  if (zombie.zombieType === "slime") {
    const splitCount = 2;
    waveTotalZombies += splitCount; // add minislimes to the wave total so clearing works
    for (let i = 0; i < splitCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spawnX = zombie.x + Math.cos(angle) * 20;
      const spawnY = zombie.y + Math.sin(angle) * 20;
      zombies.push(new Zombie(assets.zombie, MAP_WIDTH, MAP_HEIGHT, spawnX, spawnY, "minislime"));
    }
  }
}

// Input Handling
function handleInput() {
  if (player.knifing) return; // Freeze normal input during knifing animation

  let mx = 0;
  let my = 0;

  if (keyboard.isPressed("w") || keyboard.isPressed("arrowup")) {
    my = -1;
  } else if (keyboard.isPressed("s") || keyboard.isPressed("arrowdown")) {
    my = 1;
  }

  if (keyboard.isPressed("a") || keyboard.isPressed("arrowleft")) {
    mx = -1;
  } else if (keyboard.isPressed("d") || keyboard.isPressed("arrowright")) {
    mx = 1;
  }

  // Running speed modifier
  const runActive = keyboard.isPressed("shift") && player.Energy > 1;
  player.running = runActive;

  const currentMaxSpeed = runActive ? 4.0 : 2.0;

  // Apply movement speeds
  if (mx !== 0) {
    player.speedX = mx * currentMaxSpeed;
    player.moving = true;

    const targetDir = mx > 0 ? 27 : 9;
    const targetGroup = mx > 0 ? 3 : 1;
    if (player.getDirectionGroup() !== targetGroup) {
      player.direction = targetDir;
    }
  }
  if (my !== 0) {
    player.speedY = my * currentMaxSpeed;
    player.moving = true;
    // Set direction facing up/down if not moving horizontally
    if (mx === 0) {
      const targetDir = my > 0 ? 18 : 0;
      const targetGroup = my > 0 ? 2 : 0;
      if (player.getDirectionGroup() !== targetGroup) {
        player.direction = targetDir;
      }
    }
  }

  // Trigger Melee Knife Action
  if (keyboard.isPressed(" ") && player.Energy > 10) {
    player.knifing = true;
    player.knifeCounter = 0;
    
    // Choose swing sound based on weapon category
    let swingSound = "swing_light";
    if (player.currentWeapon === "Wooden Club" || player.currentWeapon === "Baseball Bat") {
      swingSound = "swing_blunt";
    } else if (player.currentWeapon === "Iron Sword" || player.currentWeapon === "Fire Axe") {
      swingSound = "swing_heavy";
    }
    sound.play(swingSound);
  }

  // Trigger Spell Tomes Action
  if (magicCooldown <= 0) {
    let aimAngle = 0;
    if (mx !== 0 || my !== 0) {
      aimAngle = Math.atan2(my, mx);
    } else {
      const dirGroup = player.getDirectionGroup();
      if (dirGroup === 0) aimAngle = -Math.PI / 2; // UP
      else if (dirGroup === 1) aimAngle = Math.PI; // LEFT
      else if (dirGroup === 2) aimAngle = Math.PI / 2; // DOWN
      else aimAngle = 0; // RIGHT
    }

    if (keyboard.isPressed("1") && player.tomes.aoe > 0) {
      player.tomes.aoe--;
      magicCooldown = 30; // ~0.5s cooldown
      sound.play("spell_blast", 0.6);
      shockwaves.push(new Shockwave(player.x + 30, player.y + 32));
    } else if (keyboard.isPressed("2") && player.tomes.fire > 0) {
      player.tomes.fire--;
      magicCooldown = 30;
      sound.play("spell_fire", 0.6);
      spellProjectiles.push(new SpellProjectile(player.x + 30, player.y + 32, aimAngle, "fire"));
    } else if (keyboard.isPressed("3") && player.tomes.poison > 0) {
      player.tomes.poison--;
      magicCooldown = 30;
      sound.play("spell_poison", 0.6);
      spellProjectiles.push(new SpellProjectile(player.x + 30, player.y + 32, aimAngle, "poison"));
    } else if (keyboard.isPressed("4") && player.tomes.frost > 0) {
      player.tomes.frost--;
      magicCooldown = 30;
      sound.play("spell_frost", 0.6);
      spellProjectiles.push(new SpellProjectile(player.x + 30, player.y + 32, aimAngle, "frost"));
    }
  }
}

// Process slash logic
function processKnifing() {
  if (!player.knifing) return;

  const stats = player.getWeaponStats();
  const speed = stats.swingSpeed;

  if (gameCounter % speed === 0) {
    player.knifeCounter += 1;
  }

  // Resolve hits when swing completes
  if (player.knifeCounter > 5) {
    const knifeHitbox = player.getKnifeHitbox();

    for (let i = 0; i < zombies.length; i++) {
      const zombie = zombies[i];
      if (zombie.visible) {
        const hit = checkRectCollision(
          knifeHitbox.x, knifeHitbox.y, knifeHitbox.w, knifeHitbox.h,
          zombie.x, zombie.y, zombie.width, zombie.height
        );

        if (hit) {
          // Swing Damage from weapon stats
          const baseDmg = stats.baseDmg;
          zombie.Health -= baseDmg * player.sMultiplier;
          zombie.aggroTarget = "player"; // Pull aggro!

          // Swing Knockback based on weapon range / stats
          const knockForce = stats.range === "large" ? 18 :
                             stats.range === "medium" ? 12 : 8;
                             
          switch (knifeHitbox.direction) {
            case 0: zombie.speedY -= knockForce; break;
            case 2: zombie.speedY += knockForce; break;
            case 1: zombie.speedX -= knockForce; break;
            case 3: zombie.speedX += knockForce; break;
          }

          // Check if zombie died
          if (zombie.Health <= 0) {
            handleZombieDeath(zombie);
          }
        }
      }
    }

    // Reset swing states
    player.knifeCounter = 0;
    player.Energy -= 10;
    player.knifing = false;
  }
}

// Process spell projectile physics and shockwaves hit checks
function updateSpells() {
  if (magicCooldown > 0) magicCooldown--;

  // Update Spell Projectiles
  for (let i = spellProjectiles.length - 1; i >= 0; i--) {
    const proj = spellProjectiles[i];
    proj.update();

    if (!proj.active) {
      spellProjectiles.splice(i, 1);
      continue;
    }

    // Check hit against zombies
    for (let j = 0; j < zombies.length; j++) {
      const zombie = zombies[j];
      if (zombie.visible) {
        const hit = checkCircleSquareCollision(
          proj.x, proj.y, proj.radius,
          zombie.x, zombie.y, zombie.width, zombie.height
        );

        if (hit) {
          zombie.aggroTarget = "player"; // Pull aggro!
          const dmgMultiplier = player.magicDamageMultiplier;
          if (proj.type === "fire") {
            zombie.Health -= 20 * dmgMultiplier;
            zombie.fireTicks = 90; // 1.5 seconds (at 60fps)
          } else if (proj.type === "poison") {
            zombie.Health -= 10 * dmgMultiplier;
            zombie.poisonTicks = 360; // 6 seconds
          } else if (proj.type === "frost") {
            zombie.Health -= 15 * dmgMultiplier;
            zombie.freezeTicks = 240; // 4 seconds slow
            if (Math.random() < 0.40) {
              zombie.isFrozenBlock = true;
              zombie.frozenBlockTicks = 180; // 3 seconds frozen solid
            }
          }
          proj.active = false;

          if (zombie.Health <= 0) {
            handleZombieDeath(zombie);
          }
          break;
        }
      }
    }
  }

  // Update Shockwaves
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const wave = shockwaves[i];
    wave.update();

    if (!wave.active) {
      shockwaves.splice(i, 1);
      continue;
    }

    for (let j = 0; j < zombies.length; j++) {
      const zombie = zombies[j];
      if (zombie.visible && !wave.hitZombies.has(zombie)) {
        const zcx = zombie.x + zombie.width / 2;
        const zcy = zombie.y + zombie.height / 2;
        const dx = zcx - wave.x;
        const dy = zcy - wave.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= wave.radius) {
          wave.hitZombies.add(zombie);
          zombie.aggroTarget = "player"; // Pull aggro!
          zombie.Health -= 50 * player.magicDamageMultiplier;

          // Apply knockback
          const knockForce = 18;
          const angle = Math.atan2(dy, dx);
          zombie.speedX += Math.cos(angle) * knockForce;
          zombie.speedY += Math.sin(angle) * knockForce;

          if (zombie.Health <= 0) {
            handleZombieDeath(zombie);
          }
        }
      }
    }
  }
}

// Check proximity to enter the teleport portal (outside)
function checkPortalProximity(): boolean {
  if (shopping || wavePhase !== "prep") return false;

  const cx = player.x + 15; // player center X
  const cy = player.y + 30; // player center Y
  const dx = cx - PORTAL_X;
  const dy = cy - PORTAL_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist <= 35; // 35px radius proximity
}

function drawTeleportPortal(ctx: CanvasRenderingContext2D) {
  if (wavePhase !== "prep" || shopping) return;

  ctx.save();
  ctx.translate(PORTAL_X, PORTAL_Y);

  // 1. Outer spinning ring
  const rotation = gameCounter * 0.02;
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
  ctx.arc(0, 0, 6 + Math.sin(gameCounter * 0.15) * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Check proximity to exit door inside shop room
function checkShopExitProximity(): boolean {
  if (!shopping) return false;
  // Exit zone centered at bottom of insideShop layout: x = [600, 680], y = [740, 800]
  const cx = player.x + 15;
  const cy = player.y + 60;
  return cx >= 580 && cx <= 700 && cy >= 730;
}

let shopStands: ShopStand[] = [
  { x: 380, y: 350, w: 50, h: 50, item: null }, // Consumable 1
  { x: 640, y: 350, w: 50, h: 50, item: null }, // Weapon
  { x: 900, y: 350, w: 50, h: 50, item: null }  // Consumable 2
];

function generateShopInventory(): void {
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

  // 3. Pick consumable 2 (different from consumable 1)
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
  shopStands[0].item = {
    type: "consumable",
    name: chosenConsumable1.name,
    cost: chosenConsumable1.cost,
    tier: chosenConsumable1.tier,
    purchased: false,
    consumableType: chosenConsumable1.consumableType,
    description: chosenConsumable1.description,
    onBuy: chosenConsumable1.onBuy
  };

  shopStands[1].item = {
    type: "weapon",
    name: chosenWeapon.weaponType,
    cost: chosenWeapon.cost,
    tier: chosenWeapon.tier,
    purchased: false,
    weaponType: chosenWeapon.weaponType
  };

  shopStands[2].item = {
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

function checkShopStandsInteractions() {
  if (!shopping) return;

  const cx = player.x + 15;
  const cy = player.y + 60;
  let activePrompt = "";

  for (const stand of shopStands) {
    const item = stand.item;
    if (!item || item.purchased) continue; // Skip empty/purchased stands

    // Proximity within 65px
    const dx = cx - stand.x;
    const dy = cy - stand.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= 65) {
      if (item.type === "weapon") {
        activePrompt = `Press [E] to buy ${item.name} (${item.cost} Coins)`;
      } else {
        activePrompt = `Press [E] to buy ${item.name} - ${item.description} (${item.cost} Coins)`;
      }

      if (keyboard.isPressed("e")) {
        if (player.Coin >= item.cost) {
          player.Coin -= item.cost;
          item.purchased = true;
          sound.play("button");
          
          if (item.type === "weapon") {
            player.currentWeapon = item.weaponType!;
            shopAnnounceMessage = `UNLOCKED: ${item.name.toUpperCase()}!`;
          } else {
            const msg = item.onBuy!(player);
            shopAnnounceMessage = msg;
          }
          
          shopAnnounceTimer = 120;
          keyboard.clear();
        } else {
          shopAnnounceMessage = "NOT ENOUGH COINS!";
          shopAnnounceTimer = 90;
          sound.play("button");
          keyboard.clear();
        }
      }
      break;
    }
  }

  // Display prompt overlay
  if (activePrompt) {
    ui.showInteractPrompt(true, activePrompt);
  } else {
    // Check if exit prompt is active instead
    const nearExit = checkShopExitProximity();
    if (nearExit) {
      ui.showInteractPrompt(true, "Press [F] to Exit Shop");
      if (keyboard.isPressed("f")) {
        exitShop();
      }
    } else {
      ui.showInteractPrompt(false);
    }
  }
}

function enterShop() {
  shopping = true;
  keyboard.clear();
  
  // Generate randomized shop inventory on entering
  generateShopInventory();

  // Teleport player centered at the bottom of the room
  player.x = 640 - 15;
  player.y = 650;
  player.speedX = 0;
  player.speedY = 0;
  player.moving = false;
  player.running = false;
}

function exitShop() {
  shopping = false;
  keyboard.clear();
  // Teleport outside in front of portal
  player.x = PORTAL_X - 15;
  player.y = PORTAL_Y + 50;

  // Reset speed/movement states to fix exit-shop speed bug
  player.speedX = 0;
  player.speedY = 0;
  player.moving = false;
  player.running = false;

  // Wave prep timer starts counting down now, capped at 5 seconds
  wavePrepTimer = 300;
  prepTimerStarted = true;
}

// Wave Progression & State Manager
function updateWaveSystem() {
  if (wavePhase === "horde") {
    // Incursion Progression
    const incursionsTotal = 2 + Math.floor(waveNumber / 2);
    incursionIntervalTimer++;

    // Check if we need to start/queue a new incursion
    if (activeIncursionDirection === null && incursionSpawnsRemaining === 0 && currentIncursionIndex < incursionsTotal) {
      let shouldQueue = false;
      if (currentIncursionIndex === 0) {
        shouldQueue = true; // Start first incursion immediately
      } else if (zombies.length === 0) {
        shouldQueue = true; // Queue if all previous zombies are dead
      } else if (incursionIntervalTimer >= 900) { // 15 seconds
        shouldQueue = true; // Queue after 15 seconds interval
      }
      
      if (shouldQueue) {
        const dirs: ("top" | "bottom" | "left" | "right")[] = ["top", "bottom", "left", "right"];
        activeIncursionDirection = dirs[Math.floor(Math.random() * dirs.length)];
        incursionWarningTimer = 120; // 2 seconds warning
        const groupSize = Math.min(10, 3 + waveNumber);
        incursionSpawnsRemaining = groupSize;
        waveTotalZombies += groupSize;
        currentIncursionIndex++;
        incursionIntervalTimer = 0;
      }
    }

    if (activeIncursionDirection !== null) {
      if (incursionWarningTimer > 0) {
        incursionWarningTimer--;
      } else if (incursionSpawnsRemaining > 0) {
        if (gameCounter % 15 === 0) {
          spawnZombieFromDirection(activeIncursionDirection);
          incursionSpawnsRemaining--;
          if (incursionSpawnsRemaining === 0) {
            activeIncursionDirection = null;
          }
        }
      }
    }

    // Check if wave is fully cleared
    if (currentIncursionIndex === incursionsTotal && incursionSpawnsRemaining === 0 && waveKilledZombies >= waveTotalZombies) {
      wavePhase = "prep";
      wavePrepTimer = 2700; // 45 seconds countdown
      prepTimerStarted = false; // Pause timer until they exit the shop
      sound.play("button");

      // Calculate gold bonus based on remaining Resonator health
      let bonusText = "";
      if (resonator) {
        const coinBonus = Math.floor(50 * (resonator.health / resonator.maxHealth));
        player.Coin += coinBonus;
        bonusText = ` RESONATOR BONUS: +${coinBonus} COINS!`;
        resonator.health = resonator.maxHealth; // Restore resonator health
      }

      shopAnnounceMessage = `WAVE CLEARED! SHOP OPENED!${bonusText}`;
      shopAnnounceTimer = 180;
      // Clear remaining active zombies array safely
      zombies = [];
    }
  } else if (wavePhase === "prep") {
    // Count down Prep Timer only if started and not inside shop
    if (prepTimerStarted && !shopping) {
      if (wavePrepTimer > 0) {
        wavePrepTimer--;
      } else {
        // Countdown ended, force start wave
        startNextWave();
      }
    }
  }
}

function startNextWave() {
  if (shopping) {
    exitShop();
  }
  wavePhase = "horde";
  waveNumber += 1;
  
  waveTotalZombies = 0; // Will be set dynamically by incursions
  waveSpawnsTriggered = 0;
  waveKilledZombies = 0;
  wavePrepTimer = 0;
  prepTimerStarted = false;

  activeIncursionDirection = null;
  incursionWarningTimer = 0;
  incursionSpawnsRemaining = 0;
  currentIncursionIndex = 0;
  incursionIntervalTimer = 0;

  if (resonator) {
    resonator.health = resonator.maxHealth;
  }

  zombies = [];
  spellProjectiles = [];
  lootDrops = [];
  shockwaves = [];
  enemyProjectiles = [];
  coinDrops = [];
  selectRandomBiome();
  
  // Clear player per-wave temporary buffs
  player.clearWaveBuffs();

  sound.play("button");
  shopAnnounceMessage = `WAVE ${waveNumber} STARTING!`;
  shopAnnounceTimer = 120;
}

// Physics Loop
function updatePhysics() {
  if (!gameStarted || player.Health <= 0) return;

  // Shopping Scene Bounds & movement
  if (shopping) {
    // Simple WASD input for inside shop movement
    let sx = 0;
    let sy = 0;
    if (keyboard.isPressed("w") || keyboard.isPressed("arrowup")) sy = -3.0;
    else if (keyboard.isPressed("s") || keyboard.isPressed("arrowdown")) sy = 3.0;

    if (keyboard.isPressed("a") || keyboard.isPressed("arrowleft")) sx = -3.0;
    else if (keyboard.isPressed("d") || keyboard.isPressed("arrowright")) sx = 3.0;

    player.speedX = sx;
    player.speedY = sy;
    player.moving = sx !== 0 || sy !== 0;

    if (sx !== 0) {
      const targetDir = sx > 0 ? 27 : 9;
      const targetGroup = sx > 0 ? 3 : 1;
      if (player.getDirectionGroup() !== targetGroup) {
        player.direction = targetDir;
      }
    } else if (sy !== 0) {
      const targetDir = sy > 0 ? 18 : 0;
      const targetGroup = sy > 0 ? 2 : 0;
      if (player.getDirectionGroup() !== targetGroup) {
        player.direction = targetDir;
      }
    } else {
      // Standing still inside shop - reset to standing frame
      const dir = player.direction;
      if (dir <= 8) player.direction = 0;
      else if (dir <= 17) player.direction = 9;
      else if (dir <= 26) player.direction = 18;
      else player.direction = 27;
    }

    if (gameCounter % 6 === 0) {
      player.animateWalking();
    }

    player.x += player.speedX;
    player.y += player.speedY;

    // Boundaries check for Shop Room (800x800 centered: x from 240 to 1040, y from 0 to 800)
    if (player.x < 245) player.x = 245;
    else if (player.x > 1035 - 30) player.x = 1035 - 30;

    if (player.y < 35) player.y = 35;
    else if (player.y > 765 - 60) player.y = 765 - 60;

    // Check interaction pedestals and E triggers
    checkShopStandsInteractions();

  } else {
    // Main Overworld Physics
    handleInput();

    const hasInput = keyboard.isPressed("w") || keyboard.isPressed("arrowup") ||
                     keyboard.isPressed("s") || keyboard.isPressed("arrowdown") ||
                     keyboard.isPressed("a") || keyboard.isPressed("arrowleft") ||
                     keyboard.isPressed("d") || keyboard.isPressed("arrowright");

    // Player walking animation timing
    const runMod = player.running ? 3 : 6;
    if (gameCounter % runMod === 0) {
      player.animateWalking();
      if (player.running) {
        player.Energy = Math.max(0, player.Energy - 0.5);
      }
    }

    // Energy recovery
    if (player.Energy < 100 && !player.running) {
      player.Energy = Math.min(100, player.Energy + player.energyRegenRate);
    }

    processKnifing();
    updateSpells();
    
    // Separate axis movement & collision for smooth sliding
    player.updateX();
    resolveObstaclesCollisionX(player, 14);

    player.updateY();
    resolveObstaclesCollisionY(player, 14);

    // Resolve collision with Biome Resonator
    if (resonator && resonator.health > 0) {
      const pCx = player.x + 29;
      const pCy = player.y + 59;
      const dx = pCx - resonator.x;
      const dy = pCy - resonator.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = resonator.radius + 14;
      if (dist < minDist) {
        const push = minDist - dist;
        if (dist > 0) {
          player.x += (dx / dist) * push;
          player.y += (dy / dist) * push;
        } else {
          player.y += push;
        }
      }
    }

    player.postUpdate(hasInput);

    // Update Coin Drops
    for (let i = coinDrops.length - 1; i >= 0; i--) {
      const coin = coinDrops[i];
      coin.update(player);
      if (!coin.active) {
        coinDrops.splice(i, 1);
      }
    }

    // Update Loot Drops (spell tomes, potions)
    for (let i = lootDrops.length - 1; i >= 0; i--) {
      const drop = lootDrops[i];
      drop.update(player);
      if (!drop.active) {
        lootDrops.splice(i, 1);
      }
    }

    // Update Hordes AI and movement
    for (let i = 0; i < zombies.length; i++) {
      const zombie = zombies[i];
      zombie.runAI(
        player,
        resonator,
        gameCounter,
        (sfx) => sound.play(sfx),
        (sx, sy, tx, ty) => {
          enemyProjectiles.push(new EnemyProjectile(sx, sy, tx, ty, 6)); // skeleton bone deals 6 damage
        }
      );

      if (gameCounter % 10 === 0) {
        zombie.animate();
      }

      zombie.update();
      if (zombie.zombieType !== "ghost") {
        resolveObstaclesCollisionAll(zombie, 14);

        // Resolve collision with Biome Resonator
        if (resonator && resonator.health > 0) {
          const zCx = zombie.x + 29;
          const zCy = zombie.y + 59;
          const dx = zCx - resonator.x;
          const dy = zCy - resonator.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = resonator.radius + 14;
          if (dist < minDist) {
            const push = minDist - dist;
            if (dist > 0) {
              zombie.x += (dx / dist) * push;
              zombie.y += (dy / dist) * push;
            } else {
              zombie.y += push;
            }
          }
        }

        // Resolve collision with player feet circle to prevent overlapping
        const pCx = player.x + 29;
        const pCy = player.y + 59;
        const zCx = zombie.x + 29;
        const zCy = zombie.y + 59;
        const dx = zCx - pCx;
        const dy = zCy - pCy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const minPlayerDist = 28; // player radius (14) + zombie radius (14)
        if (dist < minPlayerDist) {
          const pushDist = minPlayerDist - dist;
          if (dist > 0) {
            zombie.x += (dx / dist) * pushDist;
            zombie.y += (dy / dist) * pushDist;
          } else {
            const angle = Math.random() * Math.PI * 2;
            zombie.x += Math.cos(angle) * pushDist;
            zombie.y += Math.sin(angle) * pushDist;
          }
        }
      }
    }

    // Resolve zombie-zombie collisions to prevent swarms from stacking
    for (let i = 0; i < zombies.length; i++) {
      const z1 = zombies[i];
      if (z1.zombieType === "ghost" || !z1.visible) continue;
      for (let j = i + 1; j < zombies.length; j++) {
        const z2 = zombies[j];
        if (z2.zombieType === "ghost" || !z2.visible) continue;
        
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
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
      const bone = enemyProjectiles[i];
      bone.update();

      if (!bone.active) {
        enemyProjectiles.splice(i, 1);
        continue;
      }

      // Check hit against player bounding box (Hero: player.x + 15, player.y, 30, 60)
      const hit = checkCircleSquareCollision(
        bone.x, bone.y, bone.radius,
        player.x + 15, player.y, 30, 60
      );

      if (hit) {
        player.takeDamage(bone.damage);
        bone.active = false;
        sound.play("button"); // play hit sound
      }
    }

    // Proximity to enter teleport portal
    const isNearPortal = checkPortalProximity();

    if (isNearPortal) {
      ui.showInteractPrompt(true, "Press [F] to Enter Teleport");
      if (keyboard.isPressed("f")) {
        sound.play("button");
        enterShop();
      }
    } else {
      ui.showInteractPrompt(false);
    }
  }

  // Wave system ticked every frame
  updateWaveSystem();

  // Tick Alerts
  if (levelUpAlertTimer > 0) levelUpAlertTimer--;
  if (shopAnnounceTimer > 0) shopAnnounceTimer--;

  gameCounter++;
}

// standalone drawing helpers
function drawWeaponStandalone(ctx: CanvasRenderingContext2D, x: number, y: number, type: WeaponType, angle: number, sizeScale: number = 1.0) {
  const img = itemImages.get(type);
  if (img) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sizeScale, sizeScale);
    ctx.rotate(angle);
    ctx.drawImage(img, -12, -24, 24, 24);
    ctx.restore();
    return;
  }
  const stats = WEAPON_STATS[type];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sizeScale, sizeScale);
  ctx.rotate(angle);

  // Draw glow for tier 2+ weapons
  if (stats.tier >= 2) {
    ctx.shadowColor = stats.glowColor;
    ctx.shadowBlur = stats.tier >= 3 ? 12 : 6;
  }

  // Draw handle
  ctx.fillStyle = "#4a3728";
  ctx.fillRect(-2, -2, 4, 10);

  // Draw blade/head
  ctx.fillStyle = stats.color;
  ctx.fillRect(
    -stats.bladeWidth / 2,
    -stats.bladeLength,
    stats.bladeWidth,
    stats.bladeLength
  );

  // Blade edge highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fillRect(
    -stats.bladeWidth / 2,
    -stats.bladeLength,
    Math.max(1, stats.bladeWidth / 3),
    stats.bladeLength
  );

  // Guard/crossguard for swords
  if (stats.range !== "large" && type !== "Wooden Club") {
    ctx.fillStyle = stats.tier >= 2 ? "#d4af37" : "#6b7280";
    ctx.fillRect(-stats.bladeWidth, -1, stats.bladeWidth * 2, 3);
  }

  ctx.restore();
}

function drawConsumableStandalone(ctx: CanvasRenderingContext2D, x: number, y: number, consumableType: string, tier: number, bobY: number) {
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

  // Set up glow
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
    
    // Decorative seal on book cover
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

function drawPlayerVitalsUnderCharacter(ctx: CanvasRenderingContext2D) {
  const barW = 40;
  const startX = player.x + 30 - barW / 2;
  const startY = player.y + 68;

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
  ctx.fillRect(startX - 2, startY - 2, barW + 4, 10);

  // 1. HP Bar (Red)
  const hpPct = Math.max(0, player.Health) / 100;
  ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
  ctx.fillRect(startX, startY, barW, 3);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(startX, startY, barW * hpPct, 3);

  // 2. Energy Bar (Yellow)
  const energyPct = Math.max(0, player.Energy) / 100;
  ctx.fillStyle = "rgba(234, 179, 8, 0.3)";
  ctx.fillRect(startX, startY + 4, barW, 3);
  ctx.fillStyle = "#eab308";
  ctx.fillRect(startX, startY + 4, barW * energyPct, 3);

  ctx.restore();
}

function drawCanvasHUD(ctx: CanvasRenderingContext2D) {
  // 1. XP Bar (running along the very bottom of the canvas)
  ctx.save();
  const xpPct = Math.min(1.0, player.xp / player.xpNeeded);
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

  if (wavePhase === "horde") {
    ctx.font = "36px 'VT323', monospace";
    ctx.fillStyle = "#f97316";
    ctx.strokeText(`WAVE ${waveNumber}`, MAP_WIDTH / 2, 15);
    ctx.fillText(`WAVE ${waveNumber}`, MAP_WIDTH / 2, 15);
    
    const remaining = waveTotalZombies - waveKilledZombies;
    ctx.font = "20px 'VT323', monospace";
    ctx.fillStyle = "#e2e8f0";
    ctx.strokeText(`${remaining} INVASION MOBS REMAINING`, MAP_WIDTH / 2, 50);
    ctx.fillText(`${remaining} INVASION MOBS REMAINING`, MAP_WIDTH / 2, 50);
  } else if (wavePhase === "prep") {
    ctx.font = "36px 'VT323', monospace";
    ctx.fillStyle = "#22c55e";
    ctx.strokeText("PREPARATION PHASE", MAP_WIDTH / 2, 15);
    ctx.fillText("PREPARATION PHASE", MAP_WIDTH / 2, 15);

    ctx.font = "20px 'VT323', monospace";
    if (prepTimerStarted) {
      const secondsLeft = (wavePrepTimer / 60).toFixed(1);
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

  ctx.drawImage(assets.coin, MAP_WIDTH - 198, 22, 18, 18);
  
  ctx.font = "bold 26px 'VT323', monospace";
  ctx.fillStyle = "#fbbf24";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3.5;
  ctx.strokeText(player.Coin.toString(), MAP_WIDTH - 174, 32);
  ctx.fillText(player.Coin.toString(), MAP_WIDTH - 174, 32);

  ctx.font = "16px 'VT323', monospace";
  ctx.fillStyle = "#94a3b8";
  ctx.strokeText("WEAPON:", MAP_WIDTH - 198, 50);
  ctx.fillText("WEAPON:", MAP_WIDTH - 198, 50);
  
  const hudWeaponImg = itemImages.get(player.currentWeapon);
  if (hudWeaponImg) {
    ctx.drawImage(hudWeaponImg, MAP_WIDTH - 142, 42, 16, 16);
    ctx.font = "bold 18px 'VT323', monospace";
    ctx.fillStyle = "#f1f5f9";
    ctx.strokeText(player.currentWeapon, MAP_WIDTH - 122, 50);
    ctx.fillText(player.currentWeapon, MAP_WIDTH - 122, 50);
  } else {
    ctx.font = "bold 18px 'VT323', monospace";
    ctx.fillStyle = "#f1f5f9";
    ctx.strokeText(player.currentWeapon, MAP_WIDTH - 142, 50);
    ctx.fillText(player.currentWeapon, MAP_WIDTH - 142, 50);
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
  ctx.strokeText(player.level.toString(), 25, 45);
  ctx.fillText(player.level.toString(), 25, 45);
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
    { key: "1", name: "Wrath", type: "aoe", imageKey: "spelltome_aoe", count: player.tomes.aoe, color: "#fbbf24", glow: "#fbbf24" },
    { key: "2", name: "Fire", type: "fire", imageKey: "spelltome_fire", count: player.tomes.fire, color: "#f97316", glow: "#f97316" },
    { key: "3", name: "Poison", type: "poison", imageKey: "spelltome_poison", count: player.tomes.poison, color: "#22c55e", glow: "#22c55e" },
    { key: "4", name: "Frost", type: "frost", imageKey: "spelltome_frost", count: player.tomes.frost, color: "#3b82f6", glow: "#3b82f6" }
  ];

  for (let i = 0; i < 4; i++) {
    const s = spellsInfo[i];
    const sx = startSlotX + i * (slotW + spacing);
    
    ctx.save();
    // Semi-transparent box background
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

    // Fade empty slots slightly
    if (s.count === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Draw key number badge [1], [2], etc.
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 12px 'VT323', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`[${s.key}]`, sx + 6, slotsY + 5);

    // Draw Spell Name
    ctx.fillStyle = s.count > 0 ? "#f1f5f9" : "#64748b";
    ctx.font = "14px 'VT323', monospace";
    ctx.fillText(s.name, sx + 26, slotsY + 5);

    // Draw Tome Icon (16x16) or colored block
    const tImg = itemImages.get(s.imageKey);
    if (tImg) {
      ctx.drawImage(tImg, sx + 8, slotsY + 26, 20, 20);
    } else {
      ctx.fillStyle = s.color;
      ctx.fillRect(sx + 8, slotsY + 26, 20, 20);
    }

    // Draw count label (e.g. x3)
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

function generateObstacles(): void {
  obstacles = [];
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
      for (const obs of obstacles) {
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

      if (currentBiome === "grass") {
        if (type === "shrub") {
          color = "#15803d";
          outlineColor = "#14532d";
        } else if (type === "tombstone") {
          color = "#94a3b8";
          outlineColor = "#475569";
        }
      } else if (currentBiome === "desert") {
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
      } else if (currentBiome === "tundra") {
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
      } else if (currentBiome === "lava") {
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

      obstacles.push({
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

function drawSingleObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
  ctx.save();
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(obs.x, obs.y + obs.radius * 0.4, obs.radius * 1.1, obs.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    let spriteKey = "";
    if (currentBiome === "grass") {
      spriteKey = `grass_${obs.type}`;
    } else if (currentBiome === "desert") {
      if (obs.type === "shrub") {
        spriteKey = "desert_cactus";
      } else if (obs.type === "tombstone") {
        spriteKey = "desert_tumbleweed";
      } else {
        spriteKey = "desert_rock";
      }
    } else if (currentBiome === "tundra") {
      if (obs.type === "shrub") {
        spriteKey = "tundra_pine";
      } else if (obs.type === "tombstone") {
        spriteKey = "tundra_ice";
      } else {
        spriteKey = "tundra_rock";
      }
    } else if (currentBiome === "lava") {
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
      ctx.drawImage(img, obs.x - obs.radius, drawY - obs.radius, obs.radius * 2, drawH);
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
      
      if (currentBiome === "grass") {
        ctx.fillStyle = "#22c55e";
        ctx.beginPath();
        ctx.arc(obs.x - 2, obs.y - 5, 2, 0, Math.PI * 2);
        ctx.arc(obs.x + 4, obs.y + 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (currentBiome === "desert") {
        // Cactus spines
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
      if (currentBiome === "desert") {
        // Tumbleweed
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
      } else if (currentBiome === "tundra") {
        // Ice block
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
      } else if (currentBiome === "lava") {
        // Bone Pile
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
        // Standard Tombstone
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

function resolveObstaclesCollisionX(entity: { x: number, y: number, speedX: number }, radius: number) {
  const cx = entity.x + 29;
  const cy = entity.y + 59;
  
  for (const obs of obstacles) {
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

function resolveObstaclesCollisionY(entity: { x: number, y: number, speedY: number }, radius: number) {
  const cx = entity.x + 29;
  const cy = entity.y + 59;
  
  for (const obs of obstacles) {
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

function resolveObstaclesCollisionAll(entity: Zombie, radius: number) {
  const cx = entity.x + 29;
  const cy = entity.y + 59;
  
  for (const obs of obstacles) {
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

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
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

// Rendering Loop
function drawGame() {
  if (!gameStarted) return;
  ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  if (shopping) {
    // --- DRAW SHOP INTERIOR ---
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.drawImage(assets.insideShop, 240, 0, 800, 800);

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(230, 0, 10, 800);
    ctx.fillRect(1040, 0, 10, 800);

    const torchYPositions = [200, 500];
    for (const ty of torchYPositions) {
      const flickerRadius = 25 + Math.sin(gameCounter * 0.15) * 4 + Math.random() * 2;
      
      const leftGlow = ctx.createRadialGradient(245, ty, 2, 245, ty, flickerRadius);
      leftGlow.addColorStop(0, "rgba(253, 186, 116, 1)");
      leftGlow.addColorStop(0.5, "rgba(249, 115, 22, 0.4)");
      leftGlow.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.fillStyle = leftGlow;
      ctx.beginPath();
      ctx.arc(245, ty, flickerRadius, 0, Math.PI * 2);
      ctx.fill();

      const rightGlow = ctx.createRadialGradient(1035, ty, 2, 1035, ty, flickerRadius);
      rightGlow.addColorStop(0, "rgba(253, 186, 116, 1)");
      rightGlow.addColorStop(0.5, "rgba(249, 115, 22, 0.4)");
      rightGlow.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.fillStyle = rightGlow;
      ctx.beginPath();
      ctx.arc(1035, ty, flickerRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#334155";
      ctx.fillRect(235, ty - 8, 10, 16);
      ctx.fillRect(1035, ty - 8, 10, 16);
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(242, ty - 12, 6, 8);
      ctx.fillRect(1032, ty - 12, 6, 8);
    }

    ctx.fillStyle = "rgba(153, 27, 27, 0.6)";
    ctx.fillRect(580, 680, 120, 120);
    ctx.strokeStyle = "rgba(217, 119, 6, 0.8)";
    ctx.lineWidth = 3;
    ctx.strokeRect(582, 680, 116, 120);

    // 3. Draw Pedestals and interactive items
    for (const stand of shopStands) {
      const item = stand.item;
      if (!item) continue;

      ctx.save();
      const glowRadius = 50 + Math.sin(gameCounter * 0.08) * 5;
      const pedestalGlow = ctx.createRadialGradient(stand.x, stand.y + 15, 5, stand.x, stand.y + 15, glowRadius);
      
      if (!item.purchased) {
        pedestalGlow.addColorStop(0, "rgba(96, 165, 250, 0.45)");
        pedestalGlow.addColorStop(0.5, "rgba(59, 130, 246, 0.18)");
        pedestalGlow.addColorStop(1, "rgba(59, 130, 246, 0)");
      } else {
        pedestalGlow.addColorStop(0, "rgba(239, 68, 68, 0.15)");
        pedestalGlow.addColorStop(1, "rgba(239, 68, 68, 0)");
      }
      ctx.fillStyle = pedestalGlow;
      ctx.beginPath();
      ctx.arc(stand.x, stand.y + 15, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const colGradient = ctx.createLinearGradient(stand.x - 20, stand.y, stand.x + 20, stand.y);
      colGradient.addColorStop(0, "#1e293b");
      colGradient.addColorStop(0.5, "#475569");
      colGradient.addColorStop(1, "#0f172a");
      ctx.fillStyle = colGradient;
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.fillRect(stand.x - 20, stand.y - 10, 40, 50);
      ctx.strokeRect(stand.x - 20, stand.y - 10, 40, 50);

      const rimGradient = ctx.createLinearGradient(stand.x - 24, stand.y - 18, stand.x + 24, stand.y - 18);
      rimGradient.addColorStop(0, "#334155");
      rimGradient.addColorStop(0.5, "#94a3b8");
      rimGradient.addColorStop(1, "#1e293b");
      ctx.fillStyle = rimGradient;
      ctx.fillRect(stand.x - 24, stand.y - 18, 48, 8);
      ctx.strokeRect(stand.x - 24, stand.y - 18, 48, 8);

      if (!item.purchased) {
        const bobY = Math.sin(gameCounter * 0.05) * 6;
        
        if (item.type === "weapon") {
          const rotationAngle = Math.sin(gameCounter * 0.03) * 0.3 - Math.PI / 4;
          drawWeaponStandalone(ctx, stand.x, stand.y - 38 + bobY, item.weaponType!, rotationAngle, 1.25);
        } else {
          drawConsumableStandalone(ctx, stand.x, stand.y - 38, item.consumableType!, item.tier, bobY);
        }

        ctx.save();
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1;
        
        const priceLabel = `${item.cost}`;
        ctx.font = "18px 'VT323', monospace";
        const textWidth = ctx.measureText(priceLabel).width;
        const badgeW = textWidth + 30;
        const badgeH = 20;
        const badgeX = stand.x - badgeW / 2;
        const badgeY = stand.y + 48;

        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
        ctx.fill();
        ctx.stroke();

        ctx.drawImage(assets.coin, badgeX + 6, badgeY + 3, 14, 14);

        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(priceLabel, badgeX + 24, badgeY + badgeH / 2 + 1);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = item.tier === 3 ? "#c084fc" : item.tier === 2 ? "#fbbf24" : "#cbd5e1";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;

        const starCount = item.tier;
        const starSpacing = 16;
        const totalW = (starCount - 1) * starSpacing;
        const startStarX = stand.x - totalW / 2;
        const starY = stand.y - 65;

        for (let s = 0; s < starCount; s++) {
          ctx.save();
          ctx.translate(startStarX + s * starSpacing, starY);
          ctx.scale(1.1, 0.8); // squash vertically to make it less tall
          drawStar(ctx, 0, 0, 5, 8, 3.5);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        ctx.font = "18px 'VT323', monospace";
        ctx.fillStyle = "#e2e8f0";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(item.name, stand.x, stand.y - 82);
        ctx.fillText(item.name, stand.x, stand.y - 82);
        ctx.restore();

      } else {
        ctx.save();
        ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1;

        ctx.font = "16px 'VT323', monospace";
        const badgeW = 60;
        const badgeH = 18;
        const badgeX = stand.x - badgeW / 2;
        const badgeY = stand.y - 32;

        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SOLD OUT", stand.x, badgeY + badgeH / 2 + 1);
        ctx.restore();
      }
    }

    player.draw(ctx, itemImages);
    drawPlayerVitalsUnderCharacter(ctx);

  } else {
    // --- DRAW OVERWORLD ---
    let bgCanvas: HTMLCanvasElement | null = null;
    if (currentBiome === "desert") {
      bgCanvas = sandPattern;
    } else if (currentBiome === "tundra") {
      bgCanvas = snowPattern;
    } else if (currentBiome === "lava") {
      bgCanvas = lavaPattern;
    }

    if (bgCanvas) {
      ctx.drawImage(bgCanvas, 0, 0);
    } else {
      // Grass pattern (default)
      const grassPattern = ctx.createPattern(assets.grass, "repeat");
      if (grassPattern) {
        ctx.fillStyle = grassPattern;
        ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      } else {
        ctx.fillStyle = "#14532d";
        ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      }
    }

    // Draw organic biome overlay to break up pattern tiling
    if (biomeOverlayCanvas) {
      ctx.drawImage(biomeOverlayCanvas, 0, 0);
    }

    // Draw ambient dynamic/pulsing lights
    if (currentBiome === "lava") {
      ctx.save();
      // Pulsing red/orange ambient magma glows
      const pulse1 = 0.12 + Math.sin(gameCounter * 0.015) * 0.04;
      if (lavaGlow1Canvas) {
        ctx.globalAlpha = pulse1;
        ctx.drawImage(lavaGlow1Canvas, 400 - 400, 300 - 400);
      }

      const pulse2 = 0.10 + Math.cos(gameCounter * 0.02) * 0.03;
      if (lavaGlow2Canvas) {
        ctx.globalAlpha = pulse2;
        ctx.drawImage(lavaGlow2Canvas, 900 - 350, 500 - 350);
      }
      ctx.restore();
    } else if (currentBiome === "tundra") {
      ctx.save();
      // Ambient shifting ice shine
      const shimmer = 0.04 + Math.sin(gameCounter * 0.012) * 0.025;
      ctx.fillStyle = `rgba(186, 230, 253, ${shimmer})`;
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      ctx.restore();
    } else if (currentBiome === "desert") {
      ctx.save();
      // Soft ambient warm heat wash
      const wash = 0.03 + Math.sin(gameCounter * 0.008) * 0.02;
      ctx.fillStyle = `rgba(251, 191, 36, ${wash})`;
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      ctx.restore();
    }

    // Draw floor decals to break up tiling patterns
    drawFloorDecals(ctx);

    // Draw teleport portal (preparation phase only)
    drawTeleportPortal(ctx);

    // Draw active shockwaves
    for (const wave of shockwaves) {
      wave.draw(ctx);
    }

    // Draw loot drops
    for (const drop of lootDrops) {
      drop.draw(ctx, itemImages, gameCounter);
    }

    // Draw coin drops
    for (const coin of coinDrops) {
      coin.draw(ctx, gameCounter);
    }

    // Collect all Y-sortable entities (Player, Zombies, Obstacles)
    interface YSortable {
      ySort: number;
      draw: () => void;
    }
    const renderList: YSortable[] = [];

    // Add Biome Resonator
    if (resonator && resonator.health > 0) {
      renderList.push({
        ySort: resonator.y + 14,
        draw: () => resonator!.draw(ctx, gameCounter, currentBiome)
      });
    }

    // Add Player
    if (player.visible) {
      renderList.push({
        ySort: player.y + 59,
        draw: () => {
          player.draw(ctx, itemImages);
          drawPlayerVitalsUnderCharacter(ctx);
        }
      });
    }

    // Add Zombies
    for (const zombie of zombies) {
      if (zombie.visible) {
        renderList.push({
          ySort: zombie.y + 59,
          draw: () => zombie.draw(ctx)
        });
      }
    }

    // Add Obstacles
    for (const obs of obstacles) {
      renderList.push({
        ySort: obs.y,
        draw: () => drawSingleObstacle(ctx, obs)
      });
    }

    // Sort ascending by Y-coordinate
    renderList.sort((a, b) => a.ySort - b.ySort);

    // Draw Y-sorted elements
    for (const item of renderList) {
      item.draw();
    }

    // Draw spell projectiles
    for (const proj of spellProjectiles) {
      proj.draw(ctx);
    }

    // Draw enemy projectiles
    for (const bone of enemyProjectiles) {
      bone.draw(ctx, gameCounter);
    }



    // Draw Swarm Incursion warning indicators
    if (incursionWarningTimer > 0 && activeIncursionDirection !== null) {
      if (gameCounter % 20 < 10) { // Flashing frequency
        ctx.save();
        
        // Determine arrow center position based on direction
        let ax = 0;
        let ay = 0;
        let angle = 0;
        
        if (activeIncursionDirection === "top") {
          ax = MAP_WIDTH / 2;
          ay = 50;
          angle = -Math.PI / 2;
        } else if (activeIncursionDirection === "bottom") {
          ax = MAP_WIDTH / 2;
          ay = MAP_HEIGHT - 50;
          angle = Math.PI / 2;
        } else if (activeIncursionDirection === "left") {
          ax = 50;
          ay = MAP_HEIGHT / 2;
          angle = Math.PI;
        } else if (activeIncursionDirection === "right") {
          ax = MAP_WIDTH - 50;
          ay = MAP_HEIGHT / 2;
          angle = 0;
        }
        
        // Draw a glowing red warning arrow
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        
        ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(0, -25);
        ctx.lineTo(0, -10);
        ctx.lineTo(-40, -10);
        ctx.lineTo(-40, 10);
        ctx.lineTo(0, 10);
        ctx.lineTo(0, 25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Warning sign label
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", -15, 0);
        
        ctx.restore();
        
        // Center text alert
        ctx.save();
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 56px 'VT323', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 6;
        ctx.strokeText("WARNING: SWARM INCOMING!", MAP_WIDTH / 2, MAP_HEIGHT / 2 - 150);
        ctx.fillText("WARNING: SWARM INCOMING!", MAP_WIDTH / 2, MAP_HEIGHT / 2 - 150);
        ctx.restore();
      }
    }
  }

  // --- DRAW CANVAS HUD OVERLAYS ---
  drawCanvasHUD(ctx);

  // --- DRAW TEXT ALERTS ---
  if (levelUpAlertTimer > 0) {
    ctx.save();
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 64px 'VT323', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 6;
    ctx.strokeText(levelUpAlertText, MAP_WIDTH / 2, MAP_HEIGHT / 2 - 80);
    ctx.fillText(levelUpAlertText, MAP_WIDTH / 2, MAP_HEIGHT / 2 - 80);
    ctx.restore();
  }

  if (shopAnnounceTimer > 0 && shopAnnounceMessage) {
    ctx.save();
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 48px 'VT323', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 5;
    ctx.strokeText(shopAnnounceMessage, MAP_WIDTH / 2, MAP_HEIGHT / 2 + 100);
    ctx.fillText(shopAnnounceMessage, MAP_WIDTH / 2, MAP_HEIGHT / 2 + 100);
    ctx.restore();
  }

  // Draw Game Over overlay
  if (player.Health <= 0 || (resonator && resonator.health <= 0)) {
    ui.showGameOver(player.Coin, waveSpawnsTriggered, () => {
      sound.play("button");
      initGame();
    }, resonator ? resonator.health <= 0 : false);
  }
}

// Game loop
function gameLoop() {
  updatePhysics();
  drawGame();
  requestAnimationFrame(gameLoop);
}

// Start Setup Flow
async function start() {
  try {
    await preloadAssets();

    ui.showStartScreen(() => {
      sound.play("button");
      initGame();
      gameStarted = true;
    });

    requestAnimationFrame(gameLoop);
  } catch (err) {
    console.error("Critical error starting game:", err);
  }
}

start();

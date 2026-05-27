import type { BuildingTiles } from "../entities/Building";
import type { WeaponType } from "../entities/Player";
import { sound } from "./Sound";

export interface Assets {
  grass: HTMLImageElement;
  coin: HTMLImageElement | HTMLCanvasElement;
  playerWalking: HTMLImageElement;
  playerKnife: HTMLImageElement;
  zombie: HTMLImageElement;
  insideShop: HTMLImageElement;
  buildingTiles: BuildingTiles;
  heartIcon: HTMLImageElement;
  lightningIcon: HTMLImageElement;
  strengthIcon: HTMLImageElement;
}

export let assets: Assets;

export const itemImages: Map<string, HTMLImageElement | HTMLCanvasElement> = new Map();
export const biomeImages: Map<string, HTMLImageElement | HTMLCanvasElement> = new Map();

// Procedural Sprite Sheets
export let runnerSheet: HTMLCanvasElement;
export let ghostSheet: HTMLCanvasElement;
export let skeletonSheet: HTMLCanvasElement;
export let bruteSheet: HTMLCanvasElement;

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

function filterImageTransparency(baseImg: HTMLImageElement): Promise<HTMLImageElement | HTMLCanvasElement> {
  return new Promise((resolve) => {
    const canvasTemp = document.createElement("canvas");
    canvasTemp.width = baseImg.width;
    canvasTemp.height = baseImg.height;
    const ctxTemp = canvasTemp.getContext("2d")!;
    ctxTemp.drawImage(baseImg, 0, 0);

    const imgData = ctxTemp.getImageData(0, 0, canvasTemp.width, canvasTemp.height);
    const data = imgData.data;
    const w = canvasTemp.width;
    const h = canvasTemp.height;

    // Check if the image already has transparency (>3% transparent pixels).
    let transparentPixelCount = 0;
    const totalPixels = w * h;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 100) transparentPixelCount++;
    }
    const alreadyTransparent = transparentPixelCount > (totalPixels * 0.03);

    if (!alreadyTransparent) {
      // Sample all 4 corners to find the most likely background color
      const corners = [
        [data[0], data[1], data[2]],                                             // top-left
        [data[(w - 1) * 4], data[(w - 1) * 4 + 1], data[(w - 1) * 4 + 2]],     // top-right
        [data[(h - 1) * w * 4], data[(h - 1) * w * 4 + 1], data[(h - 1) * w * 4 + 2]], // bottom-left
        [data[((h - 1) * w + (w - 1)) * 4], data[((h - 1) * w + (w - 1)) * 4 + 1], data[((h - 1) * w + (w - 1)) * 4 + 2]], // bottom-right
      ];

      // Use the corner color that appears most among all 4 (fallback: top-left)
      const colorFreq: Record<string, number> = {};
      for (const [r, g, b] of corners) {
        const key = `${r},${g},${b}`;
        colorFreq[key] = (colorFreq[key] ?? 0) + 1;
      }
      const bgKey = Object.entries(colorFreq).sort((a, b) => b[1] - a[1])[0][0].split(",");
      const rBg = parseInt(bgKey[0]), gBg = parseInt(bgKey[1]), bBg = parseInt(bgKey[2]);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const diff = Math.sqrt(
          (r - rBg) * (r - rBg) +
          (g - gBg) * (g - gBg) +
          (b - bBg) * (b - bBg)
        );

        if (diff < 55) {
          data[i + 3] = 0; // fully transparent
        } else if (diff < 80) {
          // Soft edge: blend out antialiased fringe pixels
          data[i + 3] = Math.round(((diff - 55) / 25) * 255);
        }
      }
    }

    ctxTemp.putImageData(imgData, 0, 0);
    const transparentImg = new Image();
    transparentImg.src = canvasTemp.toDataURL();
    transparentImg.onload = () => resolve(transparentImg);
  });
}

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

export async function preloadAssets(): Promise<void> {
  console.log("Preloading assets...");

  const grassImg = await loadImage("/assets/grass.png");
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

  // Generate Tinted Sprite Sheets
  runnerSheet = createTintedSheet(zombieImg, "hue-rotate(310deg) saturate(1.8) contrast(1.2)");
  ghostSheet = createTintedSheet(zombieImg, "hue-rotate(240deg) saturate(1.5) brightness(1.2)");
  skeletonSheet = createTintedSheet(zombieImg, "grayscale(1) brightness(1.8) contrast(1.1)");
  bruteSheet = createTintedSheet(zombieImg, "hue-rotate(90deg) saturate(2.0) brightness(0.8)");

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

  for (const item of biomeFiles) {
    const imgRaw = await tryLoadImage(`/assets/${item.file}`);
    if (imgRaw) {
      const img = item.key.endsWith("_floor") ? imgRaw : await filterImageTransparency(imgRaw);
      biomeImages.set(item.key, img);
    }
  }

  // Preload sounds
  await sound.preload("knife", "/assets/568169__merrick079__sword-sound-2.wav");
  await sound.preload("zombie", "/assets/zombie.wav");
  await sound.preload("button", "/assets/Restart.wav");

  console.log("All assets loaded successfully.");
}

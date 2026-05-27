import { Player } from "./Player";
import { Mob } from "./Mob";

export interface BuildingTiles {
  roofback: HTMLImageElement;
  roofBL: HTMLImageElement;
  roofBR: HTMLImageElement;
  frontL: HTMLImageElement;
  frontR: HTMLImageElement;
  door: HTMLImageElement;
  window: HTMLImageElement;
  roofTL: HTMLImageElement;
  roofTR: HTMLImageElement;
}

export class Building {
  public xBase: number;
  public yBase: number;
  private tiles: BuildingTiles;
  private mainCanvas: HTMLCanvasElement | null = null;
  private topCanvas: HTMLCanvasElement | null = null;

  constructor(x: number, y: number, tiles: BuildingTiles) {
    this.xBase = x;
    this.yBase = y;
    this.tiles = tiles;
  }

  // Pre-render building sections to offscreen canvases to avoid ctx.filter performance drop
  public updateCachedCanvases(biome: string): void {
    // 1. Create main building section canvas (160x160)
    const mainC = document.createElement("canvas");
    mainC.width = 160;
    mainC.height = 160;
    const mCtx = mainC.getContext("2d")!;

    // Draw tiles at offset (16, 16)
    mCtx.drawImage(this.tiles.roofback, 16, 16, 64, 64);
    mCtx.drawImage(this.tiles.roofback, 80, 16, 64, 64);
    mCtx.drawImage(this.tiles.roofBL, 16, 16, 64, 64);
    mCtx.drawImage(this.tiles.roofBR, 80, 16, 64, 64);
    mCtx.drawImage(this.tiles.frontL, 16, 80, 64, 64);
    mCtx.drawImage(this.tiles.frontR, 80, 80, 64, 64);
    mCtx.drawImage(this.tiles.door, 72, 80, 64, 64);
    mCtx.drawImage(this.tiles.window, 11, 71, 64, 64);

    // Stone Steps/Porch
    mCtx.fillStyle = "#334155";
    mCtx.fillRect(68, 140, 48, 8);
    mCtx.fillStyle = "#475569";
    mCtx.fillRect(70, 142, 44, 6);
    mCtx.strokeStyle = "#1e293b";
    mCtx.lineWidth = 1.5;
    mCtx.strokeRect(68, 140, 48, 8);

    // Left and Right wooden structural pillars
    mCtx.fillStyle = "#5c2e0b"; // dark wood
    mCtx.fillRect(16, 80, 8, 64);
    mCtx.fillRect(136, 80, 8, 64);
    // Pillar details
    mCtx.fillStyle = "#3b1e08";
    mCtx.fillRect(16, 96, 8, 3);
    mCtx.fillRect(16, 116, 8, 3);
    mCtx.fillRect(16, 132, 8, 3);
    mCtx.fillRect(136, 96, 8, 3);
    mCtx.fillRect(136, 116, 8, 3);
    mCtx.fillRect(136, 132, 8, 3);

    // Hanging Lanterns
    const lanternXPositions = [4, 148];
    for (const lx of lanternXPositions) {
      // support chain/bar
      mCtx.fillStyle = "#1e293b";
      mCtx.fillRect(lx + 4, 88, lx === 4 ? 8 : -8, 3);
      mCtx.fillRect(lx + (lx === 4 ? 12 : -12) - 1, 91, 2, 4);

      // Lantern box
      const cx = lx + (lx === 4 ? 12 : -12);
      mCtx.fillStyle = "#334155";
      mCtx.fillRect(cx - 5, 95, 10, 14);
      mCtx.fillStyle = "#fbbf24"; // Warm yellow core
      mCtx.fillRect(cx - 3, 98, 6, 8);
      mCtx.fillStyle = "#0f172a"; // caps
      mCtx.fillRect(cx - 6, 94, 12, 2);
      mCtx.fillRect(cx - 3, 109, 6, 2);
    }

    // Striped Awning above window and door
    // Window awning
    const awH = 12;
    const awX = 14;
    const awY = 66;
    for (let s = 0; s < 6; s++) {
      mCtx.fillStyle = s % 2 === 0 ? "#6d28d9" : "#fbbf24"; // Purple / Gold stripes
      mCtx.fillRect(awX + s * 9, awY, 9, awH);
      mCtx.beginPath();
      mCtx.arc(awX + s * 9 + 4.5, awY + awH, 4.5, 0, Math.PI);
      mCtx.fill();
    }

    // Apply Biome color filter if needed
    let filter = "none";
    if (biome === "desert") {
      filter = "sepia(0.6) hue-rotate(15deg) saturate(1.2)";
    } else if (biome === "tundra") {
      filter = "hue-rotate(190deg) saturate(1.1) brightness(1.1)";
    } else if (biome === "lava") {
      filter = "hue-rotate(345deg) saturate(2.2) brightness(0.8)";
    }

    if (filter !== "none") {
      const tempC = document.createElement("canvas");
      tempC.width = 160;
      tempC.height = 160;
      const tempCtx = tempC.getContext("2d")!;
      tempCtx.filter = filter;
      tempCtx.drawImage(mainC, 0, 0);
      this.mainCanvas = tempC;
    } else {
      this.mainCanvas = mainC;
    }

    // 2. Create top roof section canvas (160x80)
    const topC = document.createElement("canvas");
    topC.width = 160;
    topC.height = 80;
    const tCtx = topC.getContext("2d")!;

    // Draw tiles at offset (16, 16)
    tCtx.drawImage(this.tiles.roofTL, 16, 16, 64, 64);
    tCtx.drawImage(this.tiles.roofTR, 80, 16, 64, 64);

    // Hanging Wooden Sign saying "SHOP"
    // Chains
    tCtx.strokeStyle = "#334155";
    tCtx.lineWidth = 1.5;
    tCtx.beginPath();
    tCtx.moveTo(68, 38); tCtx.lineTo(68, 48);
    tCtx.moveTo(92, 38); tCtx.lineTo(92, 48);
    tCtx.stroke();

    // Board
    tCtx.fillStyle = "#7c2d12"; // dark brown wood
    tCtx.fillRect(60, 48, 40, 16);
    tCtx.strokeStyle = "#431407";
    tCtx.lineWidth = 2;
    tCtx.strokeRect(60, 48, 40, 16);

    // Text
    tCtx.fillStyle = "#fef08a"; // gold letters
    tCtx.font = "bold 11px 'VT323', monospace";
    tCtx.textAlign = "center";
    tCtx.textBaseline = "middle";
    tCtx.fillText("SHOP", 80, 57);

    if (filter !== "none") {
      const tempC2 = document.createElement("canvas");
      tempC2.width = 160;
      tempC2.height = 80;
      const tempCtx2 = tempC2.getContext("2d")!;
      tempCtx2.filter = filter;
      tempCtx2.drawImage(topC, 0, 0);
      this.topCanvas = tempC2;
    } else {
      this.topCanvas = topC;
    }
  }

  // Draw bottom & main sections of the building
  public drawMain(ctx: CanvasRenderingContext2D): void {
    if (this.mainCanvas) {
      ctx.drawImage(this.mainCanvas, this.xBase - 16, this.yBase - 16);
    } else {
      const { tiles, xBase, yBase } = this;
      ctx.drawImage(tiles.roofback, xBase, yBase, 64, 64);
      ctx.drawImage(tiles.roofback, xBase + 64, yBase, 64, 64);
      ctx.drawImage(tiles.roofBL, xBase, yBase, 64, 64);
      ctx.drawImage(tiles.roofBR, xBase + 64, yBase, 64, 64);
      ctx.drawImage(tiles.frontL, xBase, yBase + 64, 64, 64);
      ctx.drawImage(tiles.frontR, xBase + 64, yBase + 64, 64, 64);
      ctx.drawImage(tiles.door, xBase + 56, yBase + 64, 64, 64);
      ctx.drawImage(tiles.window, xBase - 5, yBase + 55, 64, 64);
    }
  }

  // Draw roof top layer (renders on top of the player for a depth effect)
  public drawTop(ctx: CanvasRenderingContext2D): void {
    if (this.topCanvas) {
      ctx.drawImage(this.topCanvas, this.xBase - 16, this.yBase - 80);
    } else {
      const { tiles, xBase, yBase } = this;
      ctx.drawImage(tiles.roofTL, xBase, yBase - 64, 64, 64);
      ctx.drawImage(tiles.roofTR, xBase + 64, yBase - 64, 64, 64);
    }
  }

  // Resolve player collision along X axis
  public resolvePlayerCollisionX(player: Player): void {
    const xb = this.xBase;
    const yb = this.yBase;
    const w = 128;
    const h = 128;

    const cx = player.x + 29;
    const cy = player.y + 59;
    const radius = 14;

    const closestX = Math.max(xb, Math.min(cx, xb + w));
    const closestY = Math.max(yb, Math.min(cy, yb + h));

    const distX = cx - closestX;
    const distY = cy - closestY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    if (distance < radius) {
      // Collision detected. Resolve along X.
      const targetDistX = Math.sqrt(radius * radius - distY * distY);
      if (distX > 0) {
        player.x = closestX + targetDistX - 29;
      } else if (distX < 0) {
        player.x = closestX - targetDistX - 29;
      } else {
        if (cx < xb + w / 2) {
          player.x = xb - targetDistX - 29;
        } else {
          player.x = xb + w + targetDistX - 29;
        }
      }
      player.speedX = 0;
    }
  }

  // Resolve player collision along Y axis
  public resolvePlayerCollisionY(player: Player): void {
    const xb = this.xBase;
    const yb = this.yBase;
    const w = 128;
    const h = 128;

    const cx = player.x + 29;
    const cy = player.y + 59;
    const radius = 14;

    const closestX = Math.max(xb, Math.min(cx, xb + w));
    const closestY = Math.max(yb, Math.min(cy, yb + h));

    const distX = cx - closestX;
    const distY = cy - closestY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    if (distance < radius) {
      // Collision detected. Resolve along Y.
      const targetDistY = Math.sqrt(radius * radius - distX * distX);
      if (distY > 0) {
        player.y = closestY + targetDistY - 59;
      } else if (distY < 0) {
        player.y = closestY - targetDistY - 59;
      } else {
        if (cy < yb + h / 2) {
          player.y = yb - targetDistY - 59;
        } else {
          player.y = yb + h + targetDistY - 59;
        }
      }
      player.speedY = 0;
    }
  }

  // Resolve mob collision against building base box (xb + 10, yb, 128, 128)
  public resolveMobCollision(mob: Mob): void {
    const xb = this.xBase + 10;
    const yb = this.yBase;
    const w = 128;
    const h = 128;

    const cx = mob.x + 29;
    const cy = mob.y + 59;
    const radius = 14;

    // Find the closest point on the building box
    const closestX = Math.max(xb, Math.min(cx, xb + w));
    const closestY = Math.max(yb, Math.min(cy, yb + h));

    const distX = cx - closestX;
    const distY = cy - closestY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    if (distance < radius) {
      if (distance > 0) {
        // Push mob out along normal vector
        const pushX = (distX / distance) * (radius - distance);
        const pushY = (distY / distance) * (radius - distance);
        mob.x += pushX;
        mob.y += pushY;
      } else {
        // If center is exactly inside, push out to nearest edge
        const distLeft = cx - xb;
        const distRight = (xb + w) - cx;
        const distTop = cy - yb;
        const distBottom = (yb + h) - cy;
        const minDist = Math.min(distLeft, distRight, distTop, distBottom);

        if (minDist === distLeft) {
          mob.x = xb - 29 - radius;
        } else if (minDist === distRight) {
          mob.x = xb + w - 29 + radius;
        } else if (minDist === distTop) {
          mob.y = yb - 59 - radius;
        } else {
          mob.y = yb + h - 59 + radius;
        }
      }
    }
  }
}

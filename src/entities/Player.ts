// No imports needed here

export type WeaponType = "Wooden Sword" | "Short Sword" | "Wooden Club" | "Iron Sword" | "Baseball Bat" | "Machete" | "Fire Axe";

// Weapon stats lookup
export interface WeaponStats {
  baseDmg: number;
  range: "small" | "medium" | "large";
  swingSpeed: number; // animation ticks per frame (higher = slower)
  tier: number; // 1, 2, or 3
  color: string; // blade/handle color
  glowColor: string; // glow effect color
  bladeLength: number; // visual length in pixels
  bladeWidth: number; // visual width in pixels
}

export const WEAPON_STATS: Record<WeaponType, WeaponStats> = {
  "Wooden Sword": {
    baseDmg: 20, range: "small", swingSpeed: 3, tier: 1,
    color: "#8B6914", glowColor: "rgba(139, 105, 20, 0)", bladeLength: 18, bladeWidth: 4,
  },
  "Short Sword": {
    baseDmg: 25, range: "small", swingSpeed: 3, tier: 1,
    color: "#9ca3af", glowColor: "rgba(156, 163, 175, 0.2)", bladeLength: 20, bladeWidth: 4,
  },
  "Wooden Club": {
    baseDmg: 30, range: "medium", swingSpeed: 4, tier: 1,
    color: "#78350f", glowColor: "rgba(120, 53, 15, 0)", bladeLength: 22, bladeWidth: 7,
  },
  "Iron Sword": {
    baseDmg: 40, range: "medium", swingSpeed: 3, tier: 2,
    color: "#d1d5db", glowColor: "rgba(209, 213, 219, 0.3)", bladeLength: 24, bladeWidth: 5,
  },
  "Baseball Bat": {
    baseDmg: 45, range: "large", swingSpeed: 4, tier: 2,
    color: "#92400e", glowColor: "rgba(146, 64, 14, 0.1)", bladeLength: 26, bladeWidth: 8,
  },
  "Machete": {
    baseDmg: 55, range: "medium", swingSpeed: 3, tier: 3,
    color: "#4ade80", glowColor: "rgba(74, 222, 128, 0.4)", bladeLength: 26, bladeWidth: 5,
  },
  "Fire Axe": {
    baseDmg: 75, range: "large", swingSpeed: 5, tier: 3,
    color: "#ef4444", glowColor: "rgba(239, 68, 68, 0.5)", bladeLength: 24, bladeWidth: 10,
  },
};

export class Player {
  public x: number = 0;
  public y: number = 0;
  public speedX: number = 0;
  public speedY: number = 0;
  public visible: boolean = true;
  public moving: boolean = false;
  public running: boolean = false;
  public maxSpeed: number = 2.0;
  public knifing: boolean = false;
  public knifeCounter: number = 0;
  public sMultiplier: number = 1.0;
  public Health: number = 100;
  public Energy: number = 100;
  public Coin: number = 0; // Start with 0 coins

  // XP, Levels, and Spells
  public level: number = 1;
  public xp: number = 0;
  public xpNeeded: number = 20; // 2 walker kills needed for Level 1 -> 2
  public tomes = {
    aoe: 0,
    fire: 0,
    poison: 0,
    frost: 0
  };
  public currentWeapon: WeaponType = "Wooden Sword"; // Start with Wooden Sword

  // Buff fields (temporary per-wave)
  public damageReduction: number = 0; // 0 to 1 (0.25 = 25% reduction)
  public speedBoost: number = 0; // 0 to 1 (0.3 = 30% faster)
  public energyRegenRate: number = 0.15; // Base recovery rate per tick

  // Player status effects (ticks remaining)
  public fireTicks: number = 0;
  public frostTicks: number = 0;
  public poisonTicks: number = 0;

  // Permanent buffs
  public magicDamageMultiplier: number = 1.0;

  public readonly width: number = 30;
  public readonly height: number = 60;
  private direct: number = 18; // Start facing down

  // Sprite assets
  private walkingSprite: HTMLImageElement;
  private knifeSprite: HTMLImageElement;
  private mapWidth: number;
  private mapHeight: number;

  constructor(
    walkingSprite: HTMLImageElement,
    knifeSprite: HTMLImageElement,
    mapWidth: number,
    mapHeight: number
  ) {
    this.walkingSprite = walkingSprite;
    this.knifeSprite = knifeSprite;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    // Center player on start
    this.x = mapWidth / 2 - 30;
    this.y = mapHeight / 2 - 30;
  }

  public get direction(): number {
    return this.direct;
  }

  public set direction(value: number) {
    this.direct = value;
  }

  // Determine current active direction group: 0 = UP, 1 = LEFT, 2 = DOWN, 3 = RIGHT
  public getDirectionGroup(): number {
    if (this.direct >= 0 && this.direct <= 8) return 0; // UP
    if (this.direct >= 9 && this.direct <= 17) return 1; // LEFT
    if (this.direct >= 18 && this.direct <= 26) return 2; // DOWN
    return 3; // RIGHT (27-35)
  }

  // Handle XP addition and Level up progression
  public addXP(amount: number, onLevelUp: (lvl: number) => void): void {
    this.xp += amount;
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level += 1;
      // Quadratic scaling difficulty: 20 -> 65 -> 140 -> 245
      this.xpNeeded = 15 * this.level * this.level + 5;

      // Stats improvement on level up
      this.sMultiplier += 0.25;
      this.Health = Math.min(100, this.Health + 20);

      onLevelUp(this.level);
    }
  }

  // Get the current weapon stats
  public getWeaponStats(): WeaponStats {
    return WEAPON_STATS[this.currentWeapon];
  }

  // Clear temporary buffs (called at wave start)
  public clearWaveBuffs(): void {
    this.damageReduction = 0;
    this.speedBoost = 0;
    this.energyRegenRate = 0.15;
  }

  // Inflict damage to player, applying damage reduction buff
  public takeDamage(amount: number): void {
    const finalDmg = amount * (1 - this.damageReduction);
    this.Health = Math.max(0, this.Health - finalDmg);
  }

  public updateX(): void {
    let baseMax = this.running ? 4.0 : 2.0;
    if (this.frostTicks > 0) {
      baseMax *= 0.6; // 40% slow
    }
    this.maxSpeed = baseMax * (1 + this.speedBoost);

    this.x += this.speedX;

    // Boundaries check
    if (this.x < -10) {
      this.x = -10;
    } else if (this.x > this.mapWidth - 45) {
      this.x = this.mapWidth - 45;
    }
  }

  public updateY(): void {
    this.y += this.speedY;

    if (this.y < -5) {
      this.y = -5;
    } else if (this.y > this.mapHeight - 55) {
      this.y = this.mapHeight - 55;
    }
  }

  public postUpdate(hasInput: boolean): void {
    this.decelerate(hasInput);

    // Tick down player status effects
    if (this.fireTicks > 0) {
      this.fireTicks--;
      // Apply minor fire damage over time (0.05 damage per tick = 3 damage per second)
      this.Health = Math.max(0, this.Health - 0.05);
    }
    if (this.frostTicks > 0) {
      this.frostTicks--;
    }
    if (this.poisonTicks > 0) {
      this.poisonTicks--;
      // Apply minor poison damage over time (0.03 damage per tick = 1.8 damage per second)
      this.Health = Math.max(0, this.Health - 0.03);
    }
  }

  private decelerate(hasInput: boolean): void {
    const decel = 0.2;

    if (this.speedY > 0) {
      this.speedY = Math.max(0, this.speedY - decel);
      if (!hasInput && this.speedX === 0) {
        if (this.direct < 18 || this.direct > 26) {
          this.direct = 18;
        }
      }
    } else if (this.speedY < 0) {
      this.speedY = Math.min(0, this.speedY + decel);
      if (!hasInput && this.speedX === 0) {
        if (this.direct < 0 || this.direct > 8) {
          this.direct = 0;
        }
      }
    }

    if (this.speedX > 0) {
      this.speedX = Math.max(0, this.speedX - decel);
      if (!hasInput && (this.direct < 27 || this.direct > 35)) {
        this.direct = 27;
      }
    } else if (this.speedX < 0) {
      this.speedX = Math.min(0, this.speedX + decel);
      if (!hasInput && (this.direct < 9 || this.direct > 17)) {
        this.direct = 9;
      }
    }

    if (this.speedY === 0 && this.speedX === 0) {
      if (!hasInput) {
        if (this.direct <= 8) {
          this.direct = 0;
        } else if (this.direct <= 17) {
          this.direct = 9;
        } else if (this.direct <= 26) {
          this.direct = 18;
        } else {
          this.direct = 27;
        }
      }
      this.moving = false;
    }
  }

  public animateWalking(): void {
    if (!this.moving) return;

    const group = this.getDirectionGroup(); // 0 = UP, 1 = LEFT, 2 = DOWN, 3 = RIGHT
    this.direct += 1;

    if (group === 0) {
      if (this.direct > 8) this.direct = 0;
    } else if (group === 1) {
      if (this.direct > 17) this.direct = 9;
    } else if (group === 2) {
      if (this.direct > 26) this.direct = 18;
    } else if (group === 3) {
      if (this.direct > 35) this.direct = 27;
    }
  }

  public getKnifeHitbox(): { x: number; y: number; w: number; h: number; direction: number } {
    let xS = this.x;
    let yS = this.y;

    const stats = this.getWeaponStats();
    // Base dimensions scale depending on weapon range
    let baseW = 60;
    let baseH = 60;

    if (stats.range === "medium") {
      baseW = 80;
      baseH = 80;
    } else if (stats.range === "large") {
      baseW = 100;
      baseH = 90;
    }

    // Scale attack hitbox with strength multiplier
    const W = baseW * Math.min(2.0, Math.sqrt(this.sMultiplier));
    const H = baseH * Math.min(2.0, Math.sqrt(this.sMultiplier));
    const direction = this.getDirectionGroup(); // 0 = UP, 1 = LEFT, 2 = DOWN, 3 = RIGHT

    switch (direction) {
      case 0: // UP
        xS = this.x - (W - 30) / 2;
        yS = this.y - 20 - (H - 60);
        break;
      case 2: // DOWN
        xS = this.x - (W - 30) / 2;
        yS = this.y + 30;
        break;
      case 1: // LEFT
        xS = this.x - 20 - (W - 60);
        yS = this.y + 5 - (H - 60) / 2;
        break;
      case 3: // RIGHT
        xS = this.x + 20;
        yS = this.y + 5 - (H - 60) / 2;
        break;
    }

    return { x: xS, y: yS, w: W, h: H, direction };
  }

  // Draw the equipped weapon on the player
  private drawWeapon(ctx: CanvasRenderingContext2D, itemImages?: Map<string, HTMLImageElement>): void {
    const stats = this.getWeaponStats();
    const dirGroup = this.getDirectionGroup();

    // Weapon offset based on facing direction
    let wx = 0, wy = 0, angle = 0;

    if (this.knifing) {
      // During attack animation, swing the weapon
      const swingProgress = this.knifeCounter / 5;
      const swingAngle = -1.2 + swingProgress * 2.4; // -1.2 to 1.2 radians

      switch (dirGroup) {
        case 0: // UP
          wx = this.x + 40; wy = this.y + 10;
          angle = swingAngle - Math.PI / 2;
          break;
        case 2: // DOWN
          wx = this.x + 20; wy = this.y + 50;
          angle = swingAngle + Math.PI / 2;
          break;
        case 1: // LEFT
          wx = this.x + 8; wy = this.y + 28;
          angle = swingAngle + Math.PI;
          break;
        case 3: // RIGHT
          wx = this.x + 52; wy = this.y + 28;
          angle = swingAngle;
          break;
      }
    } else {
      // Idle/walking position — weapon held at side (aligned with hands)
      switch (dirGroup) {
        case 0: // UP - weapon behind, in right hand
          wx = this.x + 42; wy = this.y + 36;
          angle = -0.3;
          break;
        case 2: // DOWN - weapon in right hand
          wx = this.x + 18; wy = this.y + 38;
          angle = 0.3;
          break;
        case 1: // LEFT - weapon in left hand
          wx = this.x + 24; wy = this.y + 36;
          angle = 0.5;
          break;
        case 3: // RIGHT - weapon in right hand
          wx = this.x + 36; wy = this.y + 36;
          angle = -0.5;
          break;
      }
    }

    const img = itemImages?.get(this.currentWeapon);
    if (img) {
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(angle);
      // Center the image properly on the hilt
      ctx.drawImage(img, -12, -24, 24, 24);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(angle);

    // Draw glow for tier 2+ weapons
    if (stats.tier >= 2) {
      ctx.shadowColor = stats.glowColor;
      ctx.shadowBlur = stats.tier >= 3 ? 10 : 5;
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
    if (stats.range !== "large" && this.currentWeapon !== "Wooden Club") {
      ctx.fillStyle = stats.tier >= 2 ? "#d4af37" : "#6b7280";
      ctx.fillRect(-stats.bladeWidth, -1, stats.bladeWidth * 2, 3);
    }

    ctx.restore();
  }

  public draw(ctx: CanvasRenderingContext2D, itemImages?: Map<string, HTMLImageElement>): void {
    if (!this.visible) return;

    // 1. Draw Player Shadow (ellipse under feet)
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(this.x + 30, this.y + 52, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw Weapon (behind sprite for UP, in front for others)
    const dirGroup = this.getDirectionGroup();
    if (dirGroup === 0) {
      this.drawWeapon(ctx, itemImages);
    }

    // 3. Draw Sprite
    ctx.save();
    if (this.frostTicks > 0) {
      ctx.filter = "hue-rotate(180deg) saturate(1.5) brightness(1.1)";
    } else if (this.fireTicks > 0) {
      ctx.filter = "hue-rotate(330deg) saturate(2.0) brightness(1.2)";
    } else if (this.poisonTicks > 0) {
      ctx.filter = "hue-rotate(110deg) saturate(1.8) brightness(0.9)";
    }

    if (this.knifing) {
      const frameIndex = dirGroup * 6 + this.knifeCounter;

      // Slice from player knife sheet (player)
      const sx = (frameIndex % 6) * 64;
      const sy = 757 + Math.floor(frameIndex / 6) * 64;
      ctx.drawImage(
        this.knifeSprite,
        sx, sy, 61, 64, // Source rect
        this.x, this.y - 4, 61, 64 // Destination rect
      );
    } else {
      // Slice from normal walking sheet (playerwalking)
      const sx = (this.direct % 9) * 63;
      const sy = Math.floor(this.direct / 9) * 64;
      ctx.drawImage(
        this.walkingSprite,
        sx, sy, 61, 64, // Source rect
        this.x, this.y, 61, 64 // Destination rect
      );
    }
    ctx.restore();

    // 4. Draw Weapon in front for non-UP directions
    if (dirGroup !== 0) {
      this.drawWeapon(ctx, itemImages);
    }
  }
}

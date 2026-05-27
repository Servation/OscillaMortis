import { checkRectCollision } from "../engine/Collision";
import { Player } from "./Player";
import { slimeRunAI, slimeWanderAI, drawSlime } from "./mobs/SlimeBehavior";
import { ghostRunAI, drawGhost } from "./mobs/GhostBehavior";
import { skeletonRunAI, drawSkeleton } from "./mobs/SkeletonBehavior";
import { bruteRunAI } from "./mobs/BruteBehavior";
import { walkerRunAI } from "./mobs/WalkerBehavior";

export type MobType = "slime" | "minislime" | "walker" | "runner" | "ghost" | "skeleton" | "brute" |
  "fire_slime" | "fire_minislime" |
  "frost_slime" | "frost_minislime" |
  "poison_slime" | "poison_minislime";

export class Mob {
  public x: number;
  public y: number;
  public speedX: number = 0;
  public speedY: number = 0;
  public visible: boolean = true;
  public moving: boolean = false;
  public maxSpeed: number = 0.8;
  public timer: number = 0;
  public directionTime: number = 0;
  public isAtk: boolean = false;
  public atkCounter: number = 0;
  public Health: number = 100;
  public playZomSound: boolean = true;

  // AI Type State Tracking
  public mobType: MobType;
  public scale: number = 1.0;
  public filterString: string = "none";
  public damage: number = 0.1;
  public coinRewardMin: number = 5;
  public coinRewardMax: number = 30;

  // Status effects
  public fireTicks: number = 0;
  public poisonTicks: number = 0;
  public freezeTicks: number = 0;
  public isFrozenBlock: boolean = false;
  public frozenBlockTicks: number = 0;
  public hasEnteredPlayableArea: boolean = false;
  public aggroTarget: "player" | "resonator" = "resonator";
  public touchDamageCooldown: number = 0;

  // Slime specific variables
  public slimeJumpTicks: number = 0;
  public slimeRestTicks: number = 60;
  public slimeJumpDirX: number = 0;
  public slimeJumpDirY: number = 0;

  // Skeleton specific variables
  public shootCooldown: number = 100;

  // Brute specific variables
  public bruteChargeCooldown: number = 180;
  public bruteChargeTicks: number = 0;
  public brutePrepTicks: number = 0;
  public chargeDirX: number = 0;
  public chargeDirY: number = 0;

  // Ghost afterimage position history
  public posHistory: { x: number; y: number }[] = [];
  public tickCounter: number = 0;

  // Particle effects
  public dustParticles: { x: number; y: number; life: number; vx: number; vy: number }[] = [];

  public direct: number = 18; // Start facing down
  public cRadius: number = 150;
  public atkseq: number = 0;

  public spriteSheet: HTMLImageElement | HTMLCanvasElement;
  public mapWidth: number;
  public mapHeight: number;

  public get isSlimeOrMinislime(): boolean {
    return this.mobType === "slime" || 
           this.mobType === "minislime" ||
           this.mobType === "fire_slime" ||
           this.mobType === "fire_minislime" ||
           this.mobType === "frost_slime" ||
           this.mobType === "frost_minislime" ||
           this.mobType === "poison_slime" ||
           this.mobType === "poison_minislime";
  }

  public get isMinislime(): boolean {
    return this.mobType === "minislime" ||
           this.mobType === "fire_minislime" ||
           this.mobType === "frost_minislime" ||
           this.mobType === "poison_minislime";
  }

  public get maxSpeedVal(): number {
    let speed = this.maxSpeed;
    if (this.freezeTicks > 0) {
      speed *= 0.4;
    }
    if (this.isFrozenBlock) {
      speed = 0;
    }
    return speed;
  }

  public get cx(): number { return this.x - 130 + this.cRadius; }
  public get cy(): number { return this.y - 100 + this.cRadius; }

  // Scaled dimensions
  public get width(): number { return 34 * this.scale; }
  public get height(): number { return 64 * this.scale; }

  constructor(
    spriteSheet: HTMLImageElement | HTMLCanvasElement,
    mapWidth: number,
    mapHeight: number,
    spawnX: number,
    spawnY: number,
    type: MobType = "walker"
  ) {
    this.spriteSheet = spriteSheet;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.x = spawnX;
    this.y = spawnY;
    this.mobType = type;

    // Configure properties based on mob type
    if (type === "slime" || type === "fire_slime" || type === "frost_slime" || type === "poison_slime") {
      this.Health = 80;
      this.maxSpeed = 2.0;
      this.scale = 1.1;
      this.filterString = "none";
      this.damage = type === "slime" ? 0.08 : 0.06;
      this.coinRewardMin = 1;
      this.coinRewardMax = 3;
      this.slimeRestTicks = Math.floor(Math.random() * 30) + 40;
    } else if (type === "minislime" || type === "fire_minislime" || type === "frost_minislime" || type === "poison_minislime") {
      this.Health = 25;
      this.maxSpeed = 3.0;
      this.scale = 0.65;
      this.filterString = "none";
      this.damage = type === "minislime" ? 0.04 : 0.03;
      this.coinRewardMin = 0;
      this.coinRewardMax = 1;
      this.slimeRestTicks = Math.floor(Math.random() * 20) + 20;
    } else if (type === "runner") {
      this.Health = 50;
      this.maxSpeed = 1.6;
      this.scale = 0.85;
      this.filterString = "none"; // pre-tinted sheet used in Game.ts
      this.damage = 0.07;
      this.coinRewardMin = 2;
      this.coinRewardMax = 6;
    } else if (type === "ghost") {
      this.Health = 70;
      this.maxSpeed = 1.1;
      this.scale = 1.0;
      this.filterString = "none";
      this.damage = 0.06;
      this.coinRewardMin = 3;
      this.coinRewardMax = 8;
    } else if (type === "skeleton") {
      this.Health = 60;
      this.maxSpeed = 0.9;
      this.scale = 1.0;
      this.filterString = "none";
      this.damage = 0.08;
      this.coinRewardMin = 3;
      this.coinRewardMax = 8;
    } else if (type === "brute") {
      this.Health = 280;
      this.maxSpeed = 0.85;
      this.scale = 1.45;
      this.filterString = "none";
      this.damage = 0.16;
      this.coinRewardMin = 10;
      this.coinRewardMax = 25;
    } else {
      // standard walker
      this.Health = 100;
      this.maxSpeed = 0.8;
      this.scale = 1.0;
      this.filterString = "none";
      this.damage = 0.1;
      this.coinRewardMin = 1;
      this.coinRewardMax = 4;
    }
  }

  public getDirectionGroup(): number {
    if (this.direct >= 0 && this.direct <= 8) return 0; // UP
    if (this.direct >= 9 && this.direct <= 17) return 1; // LEFT
    if (this.direct >= 18 && this.direct <= 26) return 2; // DOWN
    return 3; // RIGHT
  }

  public update(): void {
    this.tickCounter++;
    if (this.touchDamageCooldown > 0) {
      this.touchDamageCooldown--;
    }
    // Process status effects
    if (this.fireTicks > 0) {
      this.fireTicks--;
      this.Health -= 0.35;
    }
    if (this.poisonTicks > 0) {
      this.poisonTicks--;
      this.Health -= 0.08;
    }
    if (this.frozenBlockTicks > 0) {
      this.frozenBlockTicks--;
      if (this.frozenBlockTicks <= 0) {
        this.isFrozenBlock = false;
      }
    }
    if (this.freezeTicks > 0) {
      this.freezeTicks--;
    }

    this.updateParticles();

    if (this.isFrozenBlock) {
      this.speedX = 0;
      this.speedY = 0;
      this.moving = false;
      return;
    }

    this.x += this.speedX;
    this.y += this.speedY;

    this.decelerate();
  }

  public decelerate(): void {
    const decel = 0.15;
    if (this.isSlimeOrMinislime) {
      // Slimes have bounce physics deceleration handled in their jump AI
      return;
    }

    if (this.speedX > 0) this.speedX = Math.max(0, this.speedX - decel);
    else if (this.speedX < 0) this.speedX = Math.min(0, this.speedX + decel);

    if (this.speedY > 0) this.speedY = Math.max(0, this.speedY - decel);
    else if (this.speedY < 0) this.speedY = Math.min(0, this.speedY + decel);

    if (this.speedY === 0 && this.speedX === 0) {
      if (this.direct < 8) {
        this.direct = 0;
      } else if (this.direct < 17) {
        this.direct = 9;
      } else if (this.direct < 26) {
        this.direct = 18;
      } else {
        this.direct = 27;
      }
      this.moving = false;
    }
  }

  public animate(): void {
    if (!this.moving) return;

    const group = this.getDirectionGroup();
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

  public chaseLR(target: { x: number; width: number }): boolean {
    const tCx = target.x + target.width / 2;
    const mCx = this.x + 30;

    if (Math.abs(tCx - mCx) > 15) {
      this.moving = true;
      if (tCx < mCx) {
        this.speedX = -this.maxSpeedVal;
        this.direct = 9; // face left
      } else {
        this.speedX = this.maxSpeedVal;
        this.direct = 27; // face right
      }
      return false;
    }
    this.speedX = 0;
    return true;
  }

  public chaseTB(target: { y: number; height: number }): boolean {
    const tCy = target.y + target.height / 2;
    const mCy = this.y + 30;

    if (Math.abs(tCy - mCy) > 15) {
      this.moving = true;
      if (tCy < mCy) {
        this.speedY = -this.maxSpeedVal;
        if (this.speedX === 0) this.direct = 0; // face up
      } else {
        this.speedY = this.maxSpeedVal;
        if (this.speedX === 0) this.direct = 18; // face down
      }
      return false;
    }
    this.speedY = 0;
    return true;
  }

  public getAttackHitbox(): { x: number; y: number; w: number; h: number } {
    let xS = this.x;
    let yS = this.y;
    const dirGroup = this.getDirectionGroup();
    const W = 35 * this.scale;
    const H = 35 * this.scale;

    if (dirGroup === 0) {
      xS = this.x + 30 - W / 2;
      yS = this.y - H + 10;
    } else if (dirGroup === 2) {
      xS = this.x + 30 - W / 2;
      yS = this.y + 64;
    } else if (dirGroup === 1) {
      xS = this.x - W + 10;
      yS = this.y + 32 - H / 2;
    } else {
      xS = this.x + 60 - 10;
      yS = this.y + 32 - H / 2;
    }

    return { x: xS, y: yS, w: W, h: H };
  }

  public performAttack(
    player: Player,
    resonator: { x: number; y: number; health: number; takeDamage: (amount: number) => void } | null,
    actualTargetType: "player" | "resonator",
    counter: number
  ): void {
    this.atkCounter = this.atkseq;
    if (counter % 5 === 0) {
      this.atkseq += 1;
    }

    const hitbox = this.getAttackHitbox();
    if (actualTargetType === "resonator" && resonator) {
      const hit = checkRectCollision(
        hitbox.x, hitbox.y, hitbox.w, hitbox.h,
        resonator.x - 28, resonator.y - 28, 56, 56
      );
      if (hit) {
        resonator.takeDamage(this.damage);
      }
    } else {
      const hit = checkRectCollision(
        hitbox.x, hitbox.y, hitbox.w, hitbox.h,
        player.x + 15, player.y, 30, 60
      );
      if (hit) {
        player.takeDamage(this.damage);
      }
    }

    if (this.atkseq > 5) {
      this.atkseq = 0;
      this.isAtk = false;
    }
  }

  public drawHealthBar(ctx: CanvasRenderingContext2D, bx: number, by: number, barW: number): void {
    const maxHp = (this.mobType === "brute") ? 280 : 
                  (this.mobType === "runner") ? 50 : 
                  (this.mobType === "ghost") ? 70 : 
                  (this.mobType === "skeleton") ? 60 :
                  (this.mobType === "slime" || this.mobType === "fire_slime" || this.mobType === "frost_slime" || this.mobType === "poison_slime") ? 80 :
                  (this.mobType === "minislime" || this.mobType === "fire_minislime" || this.mobType === "frost_minislime" || this.mobType === "poison_minislime") ? 25 : 100;
    if (this.Health >= maxHp) return;

    const barH = 5;
    const hpFrac = Math.max(0, this.Health) / maxHp;

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(bx - 1, by - 1, barW + 2, barH + 2, 3);
    ctx.fill();

    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, barH, 2);
    ctx.fill();

    const color = hpFrac > 0.5 ? "#22c55e" : hpFrac > 0.25 ? "#eab308" : "#ef4444";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, by, barW * hpFrac, barH, 2);
    ctx.fill();
  }

  public drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.dustParticles) {
      const alpha = p.life / 25;
      if (this.fireTicks > 0 && p.vy < -0.8) {
        ctx.fillStyle = `rgba(${220 + Math.random() * 35}, ${100 + Math.random() * 80}, 20, ${alpha * 0.9})`;
      } else if (this.poisonTicks > 0 && p.vy > -0.9 && p.vy < 0) {
        ctx.fillStyle = `rgba(34, 197, 94, ${alpha * 0.8})`;
      } else if (this.mobType === "brute") {
        ctx.fillStyle = `rgba(120, 80, 40, ${alpha * 0.6})`;
      } else {
        ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.4})`;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + (1 - alpha) * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  public updateParticles(): void {
    // Generate dust/smoke when running or brute charging
    const isChargingBrute = this.mobType === "brute" && this.bruteChargeTicks > 0;
    const isFeralRunner = this.mobType === "runner" && this.moving;
    const isBurning = this.fireTicks > 0;
    const isPoisoned = this.poisonTicks > 0;

    if ((isChargingBrute || isFeralRunner || isBurning || isPoisoned) && Math.random() < 0.35) {
      const px = this.x + 30 + (Math.random() - 0.5) * 20;
      const py = this.y + 55 + (Math.random() - 0.5) * 8;
      let vx = (Math.random() - 0.5) * 0.6;
      let vy = -0.2 - Math.random() * 0.5;

      if (isBurning) { vy = -1.2 - Math.random() * 0.8; }
      else if (isChargingBrute) {
        vx = -this.speedX * 0.35 + (Math.random() - 0.5) * 0.4;
        vy = -this.speedY * 0.35 - Math.random() * 0.4;
      }

      this.dustParticles.push({ x: px, y: py, life: 25, vx, vy });
    }

    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        this.dustParticles.splice(i, 1);
      }
    }
  }

  public runAI(
    player: Player,
    resonator: { x: number; y: number; radius: number; health: number; takeDamage: (amount: number) => void } | null,
    counter: number,
    playSoundCallback: (sound: string) => void,
    spawnProjectileCallback?: (sx: number, sy: number, tx: number, ty: number) => void
  ): void {
    if (!this.visible) return;

    if (this.isFrozenBlock) {
      this.speedX = 0;
      this.speedY = 0;
      this.moving = false;
      return;
    }

    if (this.isSlimeOrMinislime) {
      slimeRunAI(this, player, resonator, counter, playSoundCallback);
    } else if (this.mobType === "ghost") {
      ghostRunAI(this, player, resonator, counter, playSoundCallback);
    } else if (this.mobType === "skeleton") {
      skeletonRunAI(this, player, resonator, counter, playSoundCallback, spawnProjectileCallback);
    } else if (this.mobType === "brute") {
      bruteRunAI(this, player, resonator, counter, playSoundCallback);
    } else {
      // walker or runner
      walkerRunAI(this, player, resonator, counter, playSoundCallback);
    }
  }

  public wanderAI(): void {
    if (this.isSlimeOrMinislime) {
      slimeWanderAI(this);
      return;
    }

    const acc = 1.0;
    const currentMax = this.maxSpeedVal;
    if (this.directionTime === 0 && this.speedX > -currentMax) {
      this.speedX -= acc;
      this.moving = true;
      this.directionTime = this.x < 20 ? 1 : 0;
    } else if (this.directionTime === 1 && this.speedX < currentMax) {
      this.speedX += acc;
      this.moving = true;
      this.directionTime = this.x > this.mapWidth - 65 ? 0 : 1;
    } else if (this.directionTime === 2 && this.speedY > -currentMax) {
      this.speedY -= acc;
      this.moving = true;
      this.directionTime = this.y < 20 ? 3 : 2;
    } else if (this.directionTime === 3 && this.speedY < currentMax) {
      this.speedY += acc;
      this.moving = true;
      this.directionTime = this.y > this.mapHeight - 65 ? 2 : 3;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;

    this.drawParticles(ctx);

    if (this.isSlimeOrMinislime) {
      slimeDrawAdapter(this, ctx);
    } else if (this.mobType === "skeleton") {
      drawSkeleton(this, ctx);
    } else if (this.mobType === "ghost") {
      drawGhost(this, ctx);
    } else {
      ctx.save();
      ctx.translate(this.x + 30, this.y + 32);
      ctx.scale(this.scale, this.scale);
      ctx.translate(-(this.x + 30), -(this.y + 32));

      if (this.mobType === "brute" && this.brutePrepTicks > 0) {
        ctx.filter = "hue-rotate(300deg) saturate(2.5) contrast(1.5)";
      }

      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(this.x + 30, this.y + 52, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (this.isAtk) {
        const dirGroup = this.getDirectionGroup();
        const frameIndex = dirGroup * 6 + this.atkCounter;
        const sx = (frameIndex % 6) * 63;
        const sy = 759 + Math.floor(frameIndex / 6) * 63;
        ctx.drawImage(this.spriteSheet, sx, sy, 60, 63, this.x, this.y - 4, 61, 64);
      } else {
        const sx = (this.direct % 9) * 64;
        const sy = 505 + Math.floor(this.direct / 9) * 63;
        ctx.drawImage(this.spriteSheet, sx, sy, 62, 63, this.x, this.y, 61, 64);
      }

      if (this.mobType === "brute" && this.brutePrepTicks > 0) {
        ctx.filter = "none";
        const eyeGlow = 3 + Math.sin(this.brutePrepTicks * 0.3) * 1.5;
        const eyeAlpha = 0.7 + Math.sin(this.brutePrepTicks * 0.4) * 0.3;
        ctx.fillStyle = `rgba(239, 68, 68, ${eyeAlpha})`;
        ctx.shadowColor = "rgba(239, 68, 68, 0.8)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x + 22, this.y + 14, eyeGlow, 0, Math.PI * 2);
        ctx.arc(this.x + 38, this.y + 14, eyeGlow, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      this.drawHealthBar(ctx, this.x + 5, this.y - 10, 50);
    }

    if (this.isFrozenBlock) {
      ctx.save();
      ctx.fillStyle = "rgba(147, 197, 253, 0.4)";
      ctx.strokeStyle = "rgba(219, 234, 254, 0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(this.x - 4, this.y - 4, this.width + 8, this.height + 8, 6);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.x + 2, this.y + 4);
      ctx.lineTo(this.x + this.width - 2, this.y + this.height - 4);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function slimeDrawAdapter(z: Mob, ctx: CanvasRenderingContext2D) {
  let color = "rgba(34, 197, 94, 0.85)"; // standard green
  let outlineColor = "#15803d";
  if (z.mobType === "minislime") {
    color = "rgba(59, 130, 246, 0.85)"; // standard blue
    outlineColor = "#1d4ed8";
  } else if (z.mobType === "fire_slime") {
    color = "rgba(239, 68, 68, 0.85)"; // fire red
    outlineColor = "#b91c1c";
  } else if (z.mobType === "fire_minislime") {
    color = "rgba(249, 115, 22, 0.85)"; // fire orange
    outlineColor = "#c2410c";
  } else if (z.mobType === "frost_slime") {
    color = "rgba(6, 182, 212, 0.85)"; // frost cyan
    outlineColor = "#0e7490";
  } else if (z.mobType === "frost_minislime") {
    color = "rgba(14, 165, 233, 0.85)"; // frost sky blue
    outlineColor = "#0369a1";
  } else if (z.mobType === "poison_slime") {
    color = "rgba(168, 85, 247, 0.85)"; // poison purple
    outlineColor = "#7e22ce";
  } else if (z.mobType === "poison_minislime") {
    color = "rgba(236, 72, 153, 0.85)"; // poison pink-purple
    outlineColor = "#be185d";
  }
  drawSlime(z, ctx, color, outlineColor);
}

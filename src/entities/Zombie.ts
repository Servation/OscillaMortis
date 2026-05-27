import { checkRectCollision } from "../engine/Collision";
import { Player } from "./Player";

export type ZombieType = "slime" | "minislime" | "walker" | "runner" | "ghost" | "skeleton" | "brute" |
  "fire_slime" | "fire_minislime" |
  "frost_slime" | "frost_minislime" |
  "poison_slime" | "poison_minislime";

// Sound name map for each mob type
const MOB_SOUND_MAP: Record<ZombieType, string> = {
  slime: "slime_aggro",
  minislime: "slime_aggro",
  fire_slime: "slime_aggro",
  fire_minislime: "slime_aggro",
  frost_slime: "slime_aggro",
  frost_minislime: "slime_aggro",
  poison_slime: "slime_aggro",
  poison_minislime: "slime_aggro",
  walker: "zombie",
  runner: "runner_aggro",
  ghost: "ghost_aggro",
  skeleton: "skeleton_aggro",
  brute: "brute_aggro",
};

export class Zombie {
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
  public zombieType: ZombieType;
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

  public get isSlimeOrMinislime(): boolean {
    return this.zombieType === "slime" || 
           this.zombieType === "minislime" ||
           this.zombieType === "fire_slime" ||
           this.zombieType === "fire_minislime" ||
           this.zombieType === "frost_slime" ||
           this.zombieType === "frost_minislime" ||
           this.zombieType === "poison_slime" ||
           this.zombieType === "poison_minislime";
  }

  public get isMinislime(): boolean {
    return this.zombieType === "minislime" ||
           this.zombieType === "fire_minislime" ||
           this.zombieType === "frost_minislime" ||
           this.zombieType === "poison_minislime";
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

  // Slime specific variables
  private slimeJumpTicks: number = 0;
  private slimeRestTicks: number = 60;
  private slimeJumpDirX: number = 0;
  private slimeJumpDirY: number = 0;

  // Skeleton specific variables
  private shootCooldown: number = 100;

  // Brute specific variables
  private bruteChargeCooldown: number = 180;
  private bruteChargeTicks: number = 0;
  private brutePrepTicks: number = 0;
  private chargeDirX: number = 0;
  private chargeDirY: number = 0;

  // Ghost afterimage position history
  private posHistory: { x: number; y: number }[] = [];
  private tickCounter: number = 0;

  // Particle effects for brute charge and runner speed
  private dustParticles: { x: number; y: number; life: number; vx: number; vy: number }[] = [];

  private direct: number = 18; // Start facing down

  // Collision detection circle for aggroing player
  public cRadius: number = 150;
  public get cx(): number { return this.x - 130 + this.cRadius; }
  public get cy(): number { return this.y - 100 + this.cRadius; }

  // Scaled dimensions
  public get width(): number { return 34 * this.scale; }
  public get height(): number { return 64 * this.scale; }

  // Attack sequence frame index
  public atkseq: number = 0;

  private spriteSheet: HTMLImageElement | HTMLCanvasElement;
  private mapWidth: number;
  private mapHeight: number;

  constructor(
    spriteSheet: HTMLImageElement | HTMLCanvasElement,
    mapWidth: number,
    mapHeight: number,
    spawnX: number,
    spawnY: number,
    type: ZombieType = "walker"
  ) {
    this.spriteSheet = spriteSheet;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.x = spawnX;
    this.y = spawnY;
    this.zombieType = type;

    // Configure properties based on zombie type
    if (type === "slime" || type === "fire_slime" || type === "frost_slime" || type === "poison_slime") {
      this.Health = 80;
      this.maxSpeed = 2.0;
      this.scale = 1.1;
      this.filterString = "none";
      this.damage = type === "slime" ? 0.08 : 0.06; // Elemental touches deal slightly less raw physical but apply DOTs
      this.coinRewardMin = 1;
      this.coinRewardMax = 3;
      this.slimeRestTicks = Math.floor(Math.random() * 30) + 40;
    } else if (type === "minislime" || type === "fire_minislime" || type === "frost_minislime" || type === "poison_minislime") {
      this.Health = 25; // 25 HP so they don't get one-shot by basic wooden sword (20 dmg)
      this.maxSpeed = 3.0;
      this.scale = 0.65;
      this.filterString = "none";
      this.damage = type === "minislime" ? 0.04 : 0.03;
      this.coinRewardMin = 0;
      this.coinRewardMax = 1;
      this.slimeRestTicks = Math.floor(Math.random() * 20) + 20;
    } else if (type === "runner") {
      this.Health = 50;
      this.maxSpeed = 1.6; // High speed
      this.scale = 0.85;   // Smaller
      this.filterString = "hue-rotate(310deg) saturate(1.8) contrast(1.2)"; // Reddish feral
      this.damage = 0.07;
      this.coinRewardMin = 2;
      this.coinRewardMax = 6;
    } else if (type === "ghost") {
      this.Health = 70;
      this.maxSpeed = 1.1;
      this.scale = 1.0;
      this.filterString = "hue-rotate(240deg) saturate(1.5) brightness(1.2)"; // Translucent purple-blue
      this.damage = 0.12; // Wall phaser deals solid damage
      this.coinRewardMin = 3;
      this.coinRewardMax = 8;
    } else if (type === "skeleton") {
      this.Health = 60;
      this.maxSpeed = 0.95;
      this.scale = 0.95;
      this.filterString = "grayscale(1) brightness(1.6)"; // White skeleton look
      this.damage = 0.08;
      this.coinRewardMin = 3;
      this.coinRewardMax = 8;
      this.shootCooldown = Math.floor(Math.random() * 50) + 80;
    } else if (type === "brute") {
      this.Health = 280;   // Tanky
      this.maxSpeed = 0.45; // Slow
      this.scale = 1.35;    // Massive
      this.filterString = "hue-rotate(120deg) saturate(1.2) brightness(0.8)"; // Dark Green
      this.damage = 0.25;  // High damage
      this.coinRewardMin = 8;
      this.coinRewardMax = 15;
      this.bruteChargeCooldown = Math.floor(Math.random() * 60) + 180;
    } else {
      // walker (Classic Shambler)
      this.Health = 100;
      this.maxSpeed = 0.8; // Moderate speed (slower than player)
      this.scale = 1.0;
      this.filterString = "none";
      this.damage = 0.1;
      this.coinRewardMin = 1;
      this.coinRewardMax = 4;
    }
  }

  public get direction(): number {
    return this.direct;
  }

  public set direction(value: number) {
    this.direct = value;
  }

  public getDirectionGroup(): number {
    if (this.direct >= 0 && this.direct <= 8) return 0; // UP
    if (this.direct >= 9 && this.direct <= 17) return 1; // LEFT
    if (this.direct >= 18 && this.direct <= 26) return 2; // DOWN
    return 3; // RIGHT (27-35)
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
    } else {
      this.x += this.speedX;
      this.y += this.speedY;

      // Clamp zombie inside the map boundaries once they enter the playable area
      if (!this.hasEnteredPlayableArea) {
        if (this.x >= -10 && this.x <= this.mapWidth - 45 &&
            this.y >= -5 && this.y <= this.mapHeight - 55) {
          this.hasEnteredPlayableArea = true;
        }
      }

      if (this.hasEnteredPlayableArea) {
        this.x = Math.max(-10, Math.min(this.mapWidth - 45, this.x));
        this.y = Math.max(-5, Math.min(this.mapHeight - 55, this.y));
      } else {
        // Loose boundary to prevent flying away far out of bounds before entering
        this.x = Math.max(-60, Math.min(this.mapWidth + 30, this.x));
        this.y = Math.max(-60, Math.min(this.mapHeight + 30, this.y));
      }

      this.decelerate();
    }
  }

  private decelerate(): void {
    const decel = 0.2;

    if (this.speedY > 0) {
      this.speedY = Math.max(0, this.speedY - decel);
      if (this.speedX === 0) {
        if (this.direct < 18 || this.direct > 26) {
          this.direct = 18;
        }
      }
    } else if (this.speedY < 0) {
      this.speedY = Math.min(0, this.speedY + decel);
      if (this.speedX === 0) {
        if (this.direct < 0 || this.direct > 8) {
          this.direct = 0;
        }
      }
    }

    if (this.speedX > 0) {
      this.speedX = Math.max(0, this.speedX - decel);
      if (this.direct < 27 || this.direct > 35) {
        this.direct = 27;
      }
    } else if (this.speedX < 0) {
      this.speedX = Math.min(0, this.speedX + decel);
      if (this.direct < 9 || this.direct > 17) {
        this.direct = 9;
      }
    }

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

  // Zombie AI logic
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

    let target = { x: player.x, y: player.y, width: 61, height: 64 };
    let actualTargetType: "player" | "resonator" = "player";

    if (this.aggroTarget === "resonator" && resonator && resonator.health > 0) {
      target = { x: resonator.x - 28, y: resonator.y - 28, width: 56, height: 56 };
      actualTargetType = "resonator";
    }



    // Mobs in the invading horde always track and chase their active target
    const isTargetDetected = true;

    if (isTargetDetected) {
      if (this.playZomSound) {
        playSoundCallback(MOB_SOUND_MAP[this.zombieType] || "zombie");
        this.playZomSound = false;
      }

      const tx = actualTargetType === "resonator" ? target.x + target.width / 2 : player.x + 15;
      const ty = actualTargetType === "resonator" ? target.y + target.height / 2 : player.y + 30;

      // Handle custom AIs
      if (this.isSlimeOrMinislime) {
        // --- Slime Jump/Bounce AI ---
        if (this.slimeRestTicks > 0 && this.slimeJumpTicks === 0) {
          this.slimeRestTicks--;
          this.speedX = 0;
          this.speedY = 0;
          this.moving = false;
          if (this.slimeRestTicks === 0) {
            this.slimeJumpTicks = 35;
            const dx = tx - (this.x + 15);
            const dy = ty - (this.y + 30);
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            this.slimeJumpDirX = dx / len;
            this.slimeJumpDirY = dy / len;
          }
        }
        if (this.slimeJumpTicks > 0) {
          let jumpSpeed = this.isMinislime ? 3.2 : 2.2;
          if (this.freezeTicks > 0) jumpSpeed *= 0.4;
          if (this.isFrozenBlock) jumpSpeed = 0;
          this.speedX = this.slimeJumpDirX * jumpSpeed;
          this.speedY = this.slimeJumpDirY * jumpSpeed;
          this.moving = true;
          this.direct = this.slimeJumpDirX > 0 ? 27 : 9;
          this.slimeJumpTicks--;
          if (this.slimeJumpTicks === 0) {
            this.slimeRestTicks = Math.floor(Math.random() * 30) + 40;
          }
        }

        // Touch attack damage check
        if (this.touchDamageCooldown === 0) {
          const zCx = this.x + 30;
          const zCy = this.y + 40;
          if (actualTargetType === "resonator" && resonator) {
            const dx = zCx - resonator.x;
            const dy = zCy - resonator.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < resonator.radius + 14) {
              resonator.takeDamage(this.damage);
              this.touchDamageCooldown = 60; // 1s cooldown
            }
          } else {
            const dx = zCx - (player.x + 15);
            const dy = zCy - (player.y + 30);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 28) {
              player.takeDamage(this.damage);
              this.touchDamageCooldown = 60; // 1s cooldown

              // Apply status effect based on slime type
              if (this.zombieType === "fire_slime" || this.zombieType === "fire_minislime") {
                player.fireTicks = Math.max(player.fireTicks, 180); // 3 seconds
              } else if (this.zombieType === "frost_slime" || this.zombieType === "frost_minislime") {
                player.frostTicks = Math.max(player.frostTicks, 150); // 2.5 seconds
              } else if (this.zombieType === "poison_slime" || this.zombieType === "poison_minislime") {
                player.poisonTicks = Math.max(player.poisonTicks, 210); // 3.5 seconds
              }
            }
          }
        }
      } else if (this.zombieType === "ghost") {
        // --- Ghost Sine Wave Float AI ---
        const dx = tx - (this.x + 15);
        const dy = ty - (this.y + 30);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const dirX = dx / dist;
        const dirY = dy / dist;
        
        // Perpendicular vector for wiggling
        const perpX = -dirY;
        const perpY = dirX;
        const wiggle = Math.sin(counter * 0.12) * 1.6;

        this.speedX = dirX * this.maxSpeedVal + perpX * wiggle;
        this.speedY = dirY * this.maxSpeedVal + perpY * wiggle;
        this.moving = true;
        this.direct = dirX > 0 ? 27 : 9;
      } else if (this.zombieType === "skeleton") {
        // --- Skeleton Ranged AI ---
        const dx = tx - (this.x + 15);
        const dy = ty - (this.y + 30);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const dirX = dx / dist;
        const dirY = dy / dist;

        if (dist < 180) {
          // Retreat
          this.speedX = -dirX * this.maxSpeedVal;
          this.speedY = -dirY * this.maxSpeedVal;
          this.moving = true;
        } else if (dist > 250) {
          // Advance
          this.speedX = dirX * this.maxSpeedVal;
          this.speedY = dirY * this.maxSpeedVal;
          this.moving = true;
        } else {
          // Orbit
          const perpX = -dirY;
          const perpY = dirX;
          this.speedX = perpX * this.maxSpeedVal;
          this.speedY = perpY * this.maxSpeedVal;
          this.moving = true;
        }
        if (Math.abs(dx) > Math.abs(dy)) {
          this.direct = dirX > 0 ? 27 : 9;
        } else {
          this.direct = dirY > 0 ? 18 : 0;
        }

        // Ranged attacks
        if (this.shootCooldown > 0) {
          this.shootCooldown--;
        } else if (spawnProjectileCallback) {
          this.shootCooldown = 120 + Math.random() * 40;
          spawnProjectileCallback(this.x + 15, this.y + 30, tx, ty);
        }
      } else if (this.zombieType === "brute") {
        // --- Brute Charger AI ---
        if (this.bruteChargeCooldown > 0) {
          this.bruteChargeCooldown--;
          
          const reachedLR = this.chaseLR(target);
          const reachedTB = this.chaseTB(target);
          if (reachedLR && reachedTB && !this.moving) {
            this.isAtk = true;
            this.performAttack(player, resonator, actualTargetType, counter);
          } else {
            this.isAtk = false;
          }
          if (this.bruteChargeCooldown <= 0) {
            this.brutePrepTicks = 45; // 0.75s freeze prep
            this.speedX = 0;
            this.speedY = 0;
            this.moving = false;
          }
        } else if (this.brutePrepTicks > 0) {
          this.brutePrepTicks--;
          this.speedX = 0;
          this.speedY = 0;
          this.moving = false;
          // Face target in prep
          const dx = tx - this.x;
          this.direct = dx > 0 ? 27 : 9;
          
          if (this.brutePrepTicks === 0) {
            this.bruteChargeTicks = 40; // 0.6s dash
            const dxC = tx - (this.x + 15);
            const dyC = ty - (this.y + 30);
            const dist = Math.sqrt(dxC * dxC + dyC * dyC) || 1;
            this.chargeDirX = dxC / dist;
            this.chargeDirY = dyC / dist;
          }
        } else if (this.bruteChargeTicks > 0) {
          let chargeSpeed = 5.2;
          if (this.freezeTicks > 0) chargeSpeed *= 0.4;
          if (this.isFrozenBlock) chargeSpeed = 0;
          this.speedX = this.chargeDirX * chargeSpeed;
          this.speedY = this.chargeDirY * chargeSpeed;
          this.moving = true;
          this.direct = this.chargeDirX > 0 ? 27 : 9;
          
          this.bruteChargeTicks--;
          if (this.bruteChargeTicks === 0) {
            this.bruteChargeCooldown = 200 + Math.random() * 60;
          }

          // Damage check during charge dash
          const hitbox = this.getAttackHitbox();
          const hit = actualTargetType === "resonator" ? checkRectCollision(
            hitbox.x, hitbox.y, hitbox.w, hitbox.h,
            target.x, target.y, target.width, target.height
          ) : checkRectCollision(
            hitbox.x, hitbox.y, hitbox.w, hitbox.h,
            player.x + 15, player.y, 30, 60
          );
          if (hit) {
            if (actualTargetType === "resonator" && resonator) {
              resonator.takeDamage(this.damage * 1.5);
            } else {
              player.takeDamage(this.damage * 1.5); // Extra crash damage
            }
          }
        }
      } else {
        // --- Standard Zombie Chase ---
        const reachedLR = this.chaseLR(target);
        const reachedTB = this.chaseTB(target);

        if (reachedLR && reachedTB && !this.moving) {
          this.isAtk = true;
          this.performAttack(player, resonator, actualTargetType, counter);
        } else {
          this.isAtk = false;
        }
      }

      this.timer -= 1;
    } else {
      // Wander AI
      this.playZomSound = true;
      this.isAtk = false;

      if (this.timer <= 0) {
        this.timer = Math.floor(Math.random() * 35) + 5;
        this.directionTime = Math.floor(Math.random() * 4);
      } else {
        this.wanderAI();
      }
    }
  }

  private wanderAI(): void {
    if (this.isSlimeOrMinislime) {
      // Slime bouncy wandering
      if (this.slimeRestTicks > 0 && this.slimeJumpTicks === 0) {
        this.slimeRestTicks--;
        this.speedX = 0;
        this.speedY = 0;
        this.moving = false;
        if (this.slimeRestTicks === 0) {
          this.slimeJumpTicks = 35;
          const angle = Math.random() * Math.PI * 2;
          this.slimeJumpDirX = Math.cos(angle);
          this.slimeJumpDirY = Math.sin(angle);
        }
      }
      if (this.slimeJumpTicks > 0) {
        let jumpSpeed = this.isMinislime ? 1.6 : 1.0;
        if (this.freezeTicks > 0) jumpSpeed *= 0.4;
        if (this.isFrozenBlock) jumpSpeed = 0;
        this.speedX = this.slimeJumpDirX * jumpSpeed;
        this.speedY = this.slimeJumpDirY * jumpSpeed;
        this.moving = true;
        this.direct = this.slimeJumpDirX > 0 ? 27 : 9;
        this.slimeJumpTicks--;
        if (this.slimeJumpTicks === 0) {
          this.slimeRestTicks = Math.floor(Math.random() * 40) + 60;
        }
      }
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
    this.timer -= 1;
  }

  private chaseLR(target: { x: number; width: number }): boolean {
    const acc = 1.0;
    const currentMax = this.maxSpeedVal;
    if (this.cx > target.x + target.width) {
      if (this.speedX > -currentMax) {
        this.speedX -= acc;
      }
      this.moving = true;
      return false;
    } else if (this.cx < target.x) {
      if (this.speedX < currentMax) {
        this.speedX += acc;
      }
      this.moving = true;
      return false;
    }
    return true;
  }

  private chaseTB(target: { y: number; height: number }): boolean {
    const acc = 1.0;
    const currentMax = this.maxSpeedVal;
    if (this.cy > target.y + target.height) {
      if (this.speedY > -currentMax) {
        this.speedY -= acc;
      }
      this.moving = true;
      return false;
    } else if (this.cy < target.y) {
      if (this.speedY < currentMax) {
        this.speedY += acc;
      }
      this.moving = true;
      return false;
    }
    return true;
  }

  public getAttackHitbox(): { x: number; y: number; w: number; h: number } {
    const dirGroup = this.getDirectionGroup(); // 0 = UP, 1 = LEFT, 2 = DOWN, 3 = RIGHT
    let xS = this.x;
    let yS = this.y;
    const W = 60 * this.scale;
    const H = 60 * this.scale;

    switch (dirGroup) {
      case 0: // UP
        xS = this.x;
        yS = this.y - 20 * this.scale;
        break;
      case 2: // DOWN
        xS = this.x;
        yS = this.y + 30 * this.scale;
        break;
      case 1: // LEFT
        xS = this.x - 20 * this.scale;
        yS = this.y + 5 * this.scale;
        break;
      case 3: // RIGHT
        xS = this.x + 20 * this.scale;
        yS = this.y + 5 * this.scale;
        break;
    }

    return { x: xS, y: yS, w: W, h: H };
  }

  private performAttack(
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

  // Draw improved health bar with gradient and outline
  private drawHealthBar(ctx: CanvasRenderingContext2D, bx: number, by: number, barW: number): void {
    const maxHp = this.zombieType === "brute" ? 280 : 
                  this.zombieType === "runner" ? 50 : 
                  this.zombieType === "ghost" ? 70 : 
                  this.zombieType === "skeleton" ? 60 :
                  (this.zombieType === "slime" || this.zombieType === "fire_slime" || this.zombieType === "frost_slime" || this.zombieType === "poison_slime") ? 80 :
                  (this.zombieType === "minislime" || this.zombieType === "fire_minislime" || this.zombieType === "frost_minislime" || this.zombieType === "poison_minislime") ? 25 : 100;
    if (this.Health >= maxHp) return;

    const barH = 5;
    const hpFrac = Math.max(0, this.Health) / maxHp;

    // Dark outline
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(bx - 1, by - 1, barW + 2, barH + 2, 3);
    ctx.fill();

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, barH, 2);
    ctx.fill();

    // Health fill with gradient
    if (hpFrac > 0) {
      const grad = ctx.createLinearGradient(bx, by, bx + barW * hpFrac, by);
      if (hpFrac > 0.5) {
        grad.addColorStop(0, "#dc2626");
        grad.addColorStop(1, "#ef4444");
      } else if (hpFrac > 0.25) {
        grad.addColorStop(0, "#d97706");
        grad.addColorStop(1, "#f59e0b");
      } else {
        grad.addColorStop(0, "#991b1b");
        grad.addColorStop(1, "#dc2626");
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(bx, by, barW * hpFrac, barH, 2);
      ctx.fill();
    }
  }

  // Update particle effects
  public updateParticles(): void {
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        this.dustParticles.splice(i, 1);
      }
    }

    // Spawn fire particles
    if (this.fireTicks > 0 && Math.random() < 0.25) {
      this.dustParticles.push({
        x: this.x + 10 + Math.random() * (this.width - 20),
        y: this.y + 10 + Math.random() * (this.height - 20),
        life: 12 + Math.random() * 8,
        vx: (Math.random() - 0.5) * 1.0,
        vy: -1.0 - Math.random() * 1.5,
      });
    }
    
    // Spawn poison particles
    if (this.poisonTicks > 0 && Math.random() < 0.20) {
      this.dustParticles.push({
        x: this.x + 10 + Math.random() * (this.width - 20),
        y: this.y + 10 + Math.random() * (this.height - 20),
        life: 15 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.4 - Math.random() * 0.8,
      });
    }

    // Store position history for ghost afterimage
    if (this.zombieType === "ghost" && this.visible && this.tickCounter % 3 === 0) {
      this.posHistory.push({ x: this.x, y: this.y });
      if (this.posHistory.length > 3) {
        this.posHistory.shift();
      }
    }

    // Spawn dust for brute during charge
    if (this.zombieType === "brute" && this.bruteChargeTicks > 0) {
      this.dustParticles.push({
        x: this.x + 30 + (Math.random() - 0.5) * 20,
        y: this.y + 55,
        life: 15 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 1.5,
      });
    }

    // Spawn speed lines for runner when chasing
    if (this.zombieType === "runner" && this.moving && Math.abs(this.speedX) + Math.abs(this.speedY) > 1) {
      if (Math.random() < 0.3) {
        this.dustParticles.push({
          x: this.x + 30 - this.speedX * 3 + (Math.random() - 0.5) * 10,
          y: this.y + 50 + (Math.random() - 0.5) * 8,
          life: 8 + Math.random() * 6,
          vx: -this.speedX * 0.5,
          vy: -this.speedY * 0.5 + (Math.random() - 0.5),
        });
      }
    }
  }

  // Draw particles
  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.dustParticles) {
      const alpha = p.life / 25;
      if (this.fireTicks > 0 && p.vy < -0.8) {
        ctx.fillStyle = `rgba(${220 + Math.random() * 35}, ${100 + Math.random() * 80}, 20, ${alpha * 0.9})`;
      } else if (this.poisonTicks > 0 && p.vy > -0.9 && p.vy < 0) {
        ctx.fillStyle = `rgba(34, 197, 94, ${alpha * 0.8})`;
      } else if (this.zombieType === "brute") {
        ctx.fillStyle = `rgba(120, 80, 40, ${alpha * 0.6})`;
      } else {
        ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.4})`;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + (1 - alpha) * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawSlime(ctx: CanvasRenderingContext2D, color: string, outlineColor: string): void {
    // Squash/stretch factor
    let squashX = 1.0;
    let stretchY = 1.0;

    if (this.slimeJumpTicks > 0) {
      // In the middle of a jump: stretched vertically
      stretchY = 1.15;
      squashX = 0.85;
    } else {
      // Preparing to jump or resting: squashed horizontally/flat
      const readyFactor = this.slimeRestTicks; // rest ticks left (0 to restMax)
      if (readyFactor < 15) {
        // Deep squash right before jump
        squashX = 1.25;
        stretchY = 0.75;
      } else {
        // Soft breathe effect
        const breathe = Math.sin(this.timer * 0.1) * 0.03;
        squashX = 1.0 + breathe;
        stretchY = 1.0 - breathe;
      }
    }

    const rx = 24 * squashX * this.scale;
    const ry = 18 * stretchY * this.scale;
    const cx = this.x + 30;
    const cy = this.y + 40;

    const dirGroup = this.getDirectionGroup(); // 0 = UP, 1 = LEFT, 2 = DOWN, 3 = RIGHT

    // 1. Draw shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.9, rx * 1.0, ry * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw Slime Body Path Helper
    const drawSlimeBody = (cWidth: number, cHeight: number, xOff: number, yOff: number) => {
      ctx.beginPath();
      ctx.moveTo(cx - cWidth + xOff, cy + yOff + cHeight * 0.5);
      ctx.bezierCurveTo(
        cx - cWidth + xOff, cy + yOff - cHeight * 0.6,
        cx - cWidth * 0.5 + xOff, cy + yOff - cHeight,
        cx + xOff, cy + yOff - cHeight
      );
      ctx.bezierCurveTo(
        cx + cWidth * 0.5 + xOff, cy + yOff - cHeight,
        cx + cWidth + xOff, cy + yOff - cHeight * 0.6,
        cx + cWidth + xOff, cy + yOff + cHeight * 0.5
      );
      ctx.bezierCurveTo(
        cx + cWidth + xOff, cy + yOff + cHeight * 1.1,
        cx - cWidth + xOff, cy + yOff + cHeight * 1.1,
        cx - cWidth + xOff, cy + yOff + cHeight * 0.5
      );
      ctx.closePath();
    };

    // 3. Draw Outer Translucent Slime Body
    ctx.fillStyle = color;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 3;
    drawSlimeBody(rx, ry, 0, 0);
    ctx.fill();
    ctx.stroke();

    // 4. Draw Nucleus (inner core - shifts with direction)
    let nX = 0;
    let nY = 0;
    if (dirGroup === 0) nY = -ry * 0.2;
    else if (dirGroup === 2) nY = ry * 0.15;
    else if (dirGroup === 1) nX = -rx * 0.2;
    else if (dirGroup === 3) nX = rx * 0.2;

    ctx.save();
    let nucleusColor = "rgba(21, 128, 61, 0.6)"; // standard green slime
    if (this.zombieType === "minislime") {
      nucleusColor = "rgba(29, 78, 216, 0.6)"; // standard blue minislime
    } else if (this.zombieType === "fire_slime" || this.zombieType === "fire_minislime") {
      nucleusColor = "rgba(234, 88, 12, 0.7)"; // dark orange/red core
    } else if (this.zombieType === "frost_slime" || this.zombieType === "frost_minislime") {
      nucleusColor = "rgba(8, 145, 178, 0.7)"; // dark cyan/blue core
    } else if (this.zombieType === "poison_slime" || this.zombieType === "poison_minislime") {
      nucleusColor = "rgba(109, 40, 217, 0.7)"; // dark purple/indigo core
    }
    ctx.fillStyle = nucleusColor;
    drawSlimeBody(rx * 0.5, ry * 0.5, nX, nY + ry * 0.1);
    ctx.fill();
    ctx.restore();

    // 5. Inner highlight glow (repositioned based on facing direction)
    let hX = -rx * 0.3;
    let hY = -ry * 0.3;
    if (dirGroup === 1) { hX = -rx * 0.5; hY = -ry * 0.2; }
    else if (dirGroup === 3) { hX = rx * 0.1; hY = -ry * 0.2; }
    else if (dirGroup === 0) { hX = 0; hY = -ry * 0.5; }

    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.ellipse(cx + hX, cy + hY, rx * 0.25, ry * 0.18, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // 6. Draw Eyes (facing dependent)
    if (dirGroup !== 0) { // No eyes if facing UP (back of slime)
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      
      let eyeSizeW = 2.5 * this.scale;
      let eyeSizeH = 4 * this.scale;
      let leftEyeX = 0;
      let rightEyeX = 0;
      let eyeY = cy + ry * 0.1;

      if (dirGroup === 2) {
        // Facing DOWN - eyes spaced out
        leftEyeX = cx - rx * 0.25;
        rightEyeX = cx + rx * 0.25;
      } else if (dirGroup === 1) {
        // Facing LEFT - eyes shifted left and closer together
        leftEyeX = cx - rx * 0.6;
        rightEyeX = cx - rx * 0.25;
        eyeSizeW *= 0.7; // foreshortening
      } else if (dirGroup === 3) {
        // Facing RIGHT - eyes shifted right and closer together
        leftEyeX = cx + rx * 0.25;
        rightEyeX = cx + rx * 0.6;
        eyeSizeW *= 0.7; // foreshortening
      }

      // Draw Left Eye
      ctx.beginPath();
      ctx.ellipse(leftEyeX, eyeY, eyeSizeW, eyeSizeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw Right Eye
      ctx.beginPath();
      ctx.ellipse(rightEyeX, eyeY, eyeSizeW, eyeSizeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Health bar for slimes (positioned above the slime)
    this.drawHealthBar(ctx, cx - 22, cy - ry - 10, 44);
  }

  // Draw custom skeleton sprite (bone-white stick figure with skull)
  private drawSkeleton(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x + 30, this.y + 32);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-(this.x + 30), -(this.y + 32));

    const cx = this.x + 30;
    const dirGroup = this.getDirectionGroup(); // 0 = UP, 1 = LEFT, 2 = DOWN, 3 = RIGHT

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(cx, this.y + 55, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Skull
    ctx.fillStyle = "#e2e8f0";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, this.y + 8, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Jaw and Eyes (direction-dependent)
    if (dirGroup === 0) {
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(cx - 5, this.y + 14, 10, 4);
    } else if (dirGroup === 2) {
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(cx - 6, this.y + 15, 12, 5);

      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(cx - 4, this.y + 6, 3, 0, Math.PI * 2);
      ctx.arc(cx + 4, this.y + 6, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(cx - 4, this.y + 6, 1.5, 0, Math.PI * 2);
      ctx.arc(cx + 4, this.y + 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (dirGroup === 1) {
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(cx - 9, this.y + 15, 8, 5);

      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(cx - 5, this.y + 6, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(cx - 5, this.y + 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (dirGroup === 3) {
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(cx + 1, this.y + 15, 8, 5);

      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(cx + 5, this.y + 6, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(cx + 5, this.y + 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Spine
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, this.y + 18);
    ctx.lineTo(cx, this.y + 42);
    ctx.stroke();

    // Ribs
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ry = this.y + 22 + i * 6;
      ctx.beginPath();
      if (dirGroup === 0) {
        ctx.moveTo(cx - 8, ry);
        ctx.quadraticCurveTo(cx, ry - 2, cx + 8, ry);
      } else if (dirGroup === 2) {
        ctx.moveTo(cx - 8, ry);
        ctx.quadraticCurveTo(cx, ry + 2, cx + 8, ry);
      } else if (dirGroup === 1) {
        ctx.moveTo(cx + 4, ry - 1);
        ctx.quadraticCurveTo(cx - 8, ry + 1, cx + 4, ry + 3);
      } else if (dirGroup === 3) {
        ctx.moveTo(cx - 4, ry - 1);
        ctx.quadraticCurveTo(cx + 8, ry + 1, cx - 4, ry + 3);
      }
      ctx.stroke();
    }

    // Arms & Legs Swing walking animation
    const swing = this.moving ? Math.sin(this.tickCounter * 0.25) * 6 : 0;

    // Arms
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (dirGroup === 1) {
      // Facing LEFT
      // Left arm (front/active)
      ctx.moveTo(cx, this.y + 22);
      ctx.lineTo(cx - 14 + swing, this.y + 33 + swing * 0.5);
      ctx.stroke();
      
      // Right arm (back/hidden)
      ctx.beginPath();
      ctx.strokeStyle = "#cbd5e1";
      ctx.moveTo(cx - 2, this.y + 22);
      ctx.lineTo(cx + 5 - swing, this.y + 31 - swing * 0.5);
      ctx.stroke();
      ctx.strokeStyle = "#e2e8f0";
    } else if (dirGroup === 3) {
      // Facing RIGHT
      // Right arm (front/active)
      ctx.moveTo(cx, this.y + 22);
      ctx.lineTo(cx + 14 - swing, this.y + 33 - swing * 0.5);
      ctx.stroke();
      
      // Left arm (back/hidden)
      ctx.beginPath();
      ctx.strokeStyle = "#cbd5e1";
      ctx.moveTo(cx + 2, this.y + 22);
      ctx.lineTo(cx - 5 + swing, this.y + 31 + swing * 0.5);
      ctx.stroke();
      ctx.strokeStyle = "#e2e8f0";
    } else {
      // Facing UP/DOWN
      // Left arm
      ctx.moveTo(cx, this.y + 22);
      ctx.lineTo(cx - 14, this.y + 35 + swing);
      ctx.stroke();
      
      // Right arm
      ctx.beginPath();
      ctx.moveTo(cx, this.y + 22);
      ctx.lineTo(cx + 14, this.y + 35 - swing);
      ctx.stroke();
    }

    // Legs
    ctx.beginPath();
    if (dirGroup === 1 || dirGroup === 3) {
      // Left leg
      ctx.moveTo(cx, this.y + 42);
      ctx.lineTo(cx - 8 + swing, this.y + 58 - Math.abs(swing) * 0.3);
      ctx.stroke();
      
      // Right leg
      ctx.beginPath();
      ctx.moveTo(cx, this.y + 42);
      ctx.lineTo(cx + 8 - swing, this.y + 58 - Math.abs(swing) * 0.3);
      ctx.stroke();
    } else {
      // Left leg
      ctx.moveTo(cx, this.y + 42);
      ctx.lineTo(cx - 8 + swing, this.y + 58 - Math.abs(swing) * 0.3);
      ctx.stroke();
      
      // Right leg
      ctx.beginPath();
      ctx.moveTo(cx, this.y + 42);
      ctx.lineTo(cx + 8 - swing, this.y + 58 - Math.abs(swing) * 0.3);
      ctx.stroke();
    }

    // Joints
    ctx.fillStyle = "#f1f5f9";
    let joints: [number, number][] = [];
    if (dirGroup === 1) {
      joints = [
        [cx - 14 + swing, this.y + 33 + swing * 0.5], 
        [cx + 5 - swing, this.y + 31 - swing * 0.5],
        [cx - 8 + swing, this.y + 58 - Math.abs(swing) * 0.3], 
        [cx + 8 - swing, this.y + 58 - Math.abs(swing) * 0.3]
      ];
    } else if (dirGroup === 3) {
      joints = [
        [cx - 5 + swing, this.y + 31 + swing * 0.5], 
        [cx + 14 - swing, this.y + 33 - swing * 0.5],
        [cx - 8 + swing, this.y + 58 - Math.abs(swing) * 0.3], 
        [cx + 8 - swing, this.y + 58 - Math.abs(swing) * 0.3]
      ];
    } else {
      joints = [
        [cx - 14, this.y + 35 + swing], 
        [cx + 14, this.y + 35 - swing],
        [cx - 8 + swing, this.y + 58 - Math.abs(swing) * 0.3], 
        [cx + 8 - swing, this.y + 58 - Math.abs(swing) * 0.3]
      ];
    }
    for (const [jx, jy] of joints) {
      ctx.beginPath();
      ctx.arc(jx, jy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Health bar
    this.drawHealthBar(ctx, this.x + 5, this.y - 8, 50);
  }

  // Draw ghost with afterimage trail
  private drawGhost(ctx: CanvasRenderingContext2D): void {
    // Draw afterimage trail
    for (let i = 0; i < this.posHistory.length; i++) {
      const pos = this.posHistory[i];
      const alpha = (i / this.posHistory.length) * 0.2;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(pos.x + 30, pos.y + 32);
      ctx.scale(this.scale, this.scale);
      ctx.translate(-(pos.x + 30), -(pos.y + 32));

      const sx = (this.direct % 9) * 64;
      const sy = 505 + Math.floor(this.direct / 9) * 63;
      ctx.drawImage(this.spriteSheet, sx, sy, 62, 63, pos.x, pos.y, 61, 64);
      ctx.restore();
    }

    // Main ghost body
    ctx.save();
    ctx.translate(this.x + 30, this.y + 32);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-(this.x + 30), -(this.y + 32));

    // Pulsing glow aura (optimized to avoid garbage collection and render lag from radial gradients)
    const glowSize = 35 + Math.sin(Date.now() * 0.005) * 5;
    ctx.fillStyle = "rgba(168, 85, 247, 0.08)";
    ctx.beginPath();
    ctx.arc(this.x + 30, this.y + 32, glowSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.55;
    ctx.shadowColor = "rgba(168, 85, 247, 0.6)";
    ctx.shadowBlur = 12;

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.beginPath();
    ctx.ellipse(this.x + 30, this.y + 52, 14, 5, 0, 0, Math.PI * 2);
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
    ctx.restore();

    // Health bar
    this.drawHealthBar(ctx, this.x + 5, this.y - 8, 50);
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;

    // Draw particles first (behind the mob)
    this.drawParticles(ctx);

    if (this.isSlimeOrMinislime) {
      let color = "rgba(34, 197, 94, 0.85)"; // standard green
      let outlineColor = "#15803d";
      if (this.zombieType === "minislime") {
        color = "rgba(59, 130, 246, 0.85)"; // standard blue
        outlineColor = "#1d4ed8";
      } else if (this.zombieType === "fire_slime") {
        color = "rgba(239, 68, 68, 0.85)"; // fire red
        outlineColor = "#b91c1c";
      } else if (this.zombieType === "fire_minislime") {
        color = "rgba(249, 115, 22, 0.85)"; // fire orange
        outlineColor = "#c2410c";
      } else if (this.zombieType === "frost_slime") {
        color = "rgba(6, 182, 212, 0.85)"; // frost cyan
        outlineColor = "#0e7490";
      } else if (this.zombieType === "frost_minislime") {
        color = "rgba(14, 165, 233, 0.85)"; // frost sky blue
        outlineColor = "#0369a1";
      } else if (this.zombieType === "poison_slime") {
        color = "rgba(168, 85, 247, 0.85)"; // poison purple
        outlineColor = "#7e22ce";
      } else if (this.zombieType === "poison_minislime") {
        color = "rgba(236, 72, 153, 0.85)"; // poison pink-purple
        outlineColor = "#be185d";
      }
      this.drawSlime(ctx, color, outlineColor);
    } else if (this.zombieType === "skeleton") {
      this.drawSkeleton(ctx);
    } else if (this.zombieType === "ghost") {
      this.drawGhost(ctx);
    } else {
      ctx.save();
      
      // Scale and filter setup
      ctx.translate(this.x + 30, this.y + 32);
      ctx.scale(this.scale, this.scale);
      ctx.translate(-(this.x + 30), -(this.y + 32));

      if (this.zombieType === "brute" && this.brutePrepTicks > 0) {
        ctx.filter = "hue-rotate(300deg) saturate(2.5) contrast(1.5)";
      }

      // Shadow (relative to scale)
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(this.x + 30, this.y + 52, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw Sprite
      if (this.isAtk) {
        const dirGroup = this.getDirectionGroup(); // 0: UP, 1: LEFT, 2: DOWN, 3: RIGHT
        const frameIndex = dirGroup * 6 + this.atkCounter;

        // Slice from attack sheet (zombie) at offset y = 759
        const sx = (frameIndex % 6) * 63;
        const sy = 759 + Math.floor(frameIndex / 6) * 63;
        ctx.drawImage(
          this.spriteSheet,
          sx, sy, 60, 63,
          this.x, this.y - 4, 61, 64
        );
      } else {
        // Slice from walking sheet (zombie) at offset y = 505
        const sx = (this.direct % 9) * 64;
        const sy = 505 + Math.floor(this.direct / 9) * 63;
        ctx.drawImage(
          this.spriteSheet,
          sx, sy, 62, 63,
          this.x, this.y, 61, 64
        );
      }

      // Brute red eyes during charge prep
      if (this.zombieType === "brute" && this.brutePrepTicks > 0) {
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

      // Health bar (after restore)
      this.drawHealthBar(ctx, this.x + 5, this.y - 10, 50);
    }

    // Draw ice block if frozen solid (on top of any mob type)
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

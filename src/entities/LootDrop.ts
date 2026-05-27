import { MAP_WIDTH, MAP_HEIGHT, sound } from "../main";
import { Player } from "./Player";

export class LootDrop {
  public x: number;
  public y: number;
  public speedX: number;
  public speedY: number;
  public active: boolean = true;
  public type: "aoe" | "fire" | "poison" | "frost" | "health" | "energy";
  public friction: number = 0.95;
  public life: number = 600;
  public sparkleTimer: number = 0;

  constructor(x: number, y: number, type: "aoe" | "fire" | "poison" | "frost" | "health" | "energy") {
    this.x = x;
    this.y = y;
    this.type = type;
    const angle = Math.random() * Math.PI * 2;
    const force = 1.5 + Math.random() * 3.0;
    this.speedX = Math.cos(angle) * force;
    this.speedY = Math.sin(angle) * force;
    this.sparkleTimer = Math.floor(Math.random() * 30);
  }

  public update(player: Player) {
    this.speedX *= this.friction;
    this.speedY *= this.friction;
    this.x += this.speedX;
    this.y += this.speedY;

    if (this.x < 10) { this.x = 10; this.speedX *= -0.5; }
    if (this.x > MAP_WIDTH - 10) { this.x = MAP_WIDTH - 10; this.speedX *= -0.5; }
    if (this.y < 10) { this.y = 10; this.speedY *= -0.5; }
    if (this.y > MAP_HEIGHT - 10) { this.y = MAP_HEIGHT - 10; this.speedY *= -0.5; }

    const px = player.x + 30;
    const py = player.y + 32;
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 80) {
      const magSpeed = 5.0;
      this.speedX += (dx / dist) * 0.8;
      this.speedY += (dy / dist) * 0.8;
      const currentSpeed = Math.sqrt(this.speedX * this.speedX + this.speedY * this.speedY);
      if (currentSpeed > magSpeed) {
        this.speedX = (this.speedX / currentSpeed) * magSpeed;
        this.speedY = (this.speedY / currentSpeed) * magSpeed;
      }
    }

    if (dist < 20) {
      if (this.type === "health") {
        player.Health = Math.min(100, player.Health + 25);
        sound.play("coin_pickup", 0.6);
      } else if (this.type === "energy") {
        player.Energy = Math.min(100, player.Energy + 40);
        sound.play("coin_pickup", 0.6);
      } else {
        player.tomes[this.type]++;
        sound.play("coin_pickup", 0.5);
      }
      this.active = false;
    }

    this.life--;
    if (this.life <= 0) {
      this.active = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, itemImages: Map<string, HTMLImageElement>, gameCounter: number) {
    ctx.save();
    if (this.life < 120) {
      ctx.globalAlpha = this.life / 120;
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 6, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(gameCounter * 0.1 + this.sparkleTimer) * 2;

    ctx.save();
    ctx.translate(this.x, this.y + bob);

    const key = this.type === "health" ? "health_1" :
                this.type === "energy" ? "energy" :
                this.type === "fire" ? "spelltome_fire" :
                this.type === "poison" ? "spelltome_poison" :
                this.type === "frost" ? "spelltome_frost" : "spelltome_aoe";
    const img = itemImages.get(key);

    if (img) {
      ctx.shadowColor = this.type === "health" ? "#ef4444" :
                        this.type === "energy" ? "#eab308" :
                        this.type === "fire" ? "#f97316" :
                        this.type === "poison" ? "#22c55e" :
                        this.type === "frost" ? "#3b82f6" : "#fbbf24";
      ctx.shadowBlur = 8;
      ctx.drawImage(img, -12, -12, 24, 24);
    } else if (this.type === "health") {
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(0, 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-2, -5, 4, 4);
      ctx.fillStyle = "#854d0e";
      ctx.fillRect(-3, -7, 6, 2);
    } else if (this.type === "energy") {
      ctx.shadowColor = "#eab308";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.arc(0, 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-2, -5, 4, 4);
      ctx.fillStyle = "#854d0e";
      ctx.fillRect(-3, -7, 6, 2);
    } else {
      ctx.shadowColor = this.type === "fire" ? "#f97316" :
                        this.type === "poison" ? "#22c55e" :
                        this.type === "frost" ? "#3b82f6" : "#fbbf24";
      ctx.shadowBlur = 8;

      ctx.fillStyle = this.type === "fire" ? "#ef4444" :
                      this.type === "poison" ? "#10b981" :
                      this.type === "frost" ? "#2563eb" : "#d97706";
      ctx.fillRect(-6, -8, 12, 16);
      
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-4, -6, 8, 2);
      ctx.fillRect(-4, -2, 8, 2);
    }

    ctx.restore();
    ctx.restore();
  }
}

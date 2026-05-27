export class BiomeResonator {
  public x: number = 640;
  public y: number = 400;
  public readonly radius: number = 28;
  public maxHealth: number = 250;
  public health: number = 250;
  private shieldAngle: number = 0;
  private pulseRadius: number = 0;
  public flashTicks: number = 0;

  constructor() {
    this.x = 640;
    this.y = 400;
    this.health = 250;
  }

  public takeDamage(amount: number): void {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.flashTicks = 15;
  }

  public draw(ctx: CanvasRenderingContext2D, gameCounter: number, biome: string): void {
    ctx.save();
    ctx.translate(this.x, this.y);

    let color = "#10b981";
    let shieldColor = "rgba(16, 185, 129, 0.18)";
    if (biome === "desert") {
      color = "#eab308";
      shieldColor = "rgba(234, 179, 8, 0.18)";
    } else if (biome === "tundra") {
      color = "#3b82f6";
      shieldColor = "rgba(59, 130, 246, 0.18)";
    } else if (biome === "lava") {
      color = "#ef4444";
      shieldColor = "rgba(239, 68, 68, 0.18)";
    }

    if (this.flashTicks > 0) {
      color = "#ef4444";
      shieldColor = "rgba(239, 68, 68, 0.45)";
      this.flashTicks--;
    }

    this.pulseRadius = 28 + Math.sin(gameCounter * 0.1) * 8;
    ctx.fillStyle = shieldColor;
    ctx.beginPath();
    ctx.arc(0, 0, this.pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    this.shieldAngle += 0.025;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 36, this.shieldAngle, this.shieldAngle + Math.PI * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 36, this.shieldAngle + Math.PI, this.shieldAngle + Math.PI * 1.5);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 22);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, 22);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    const barW = 56;
    const barH = 5;
    const bx = this.x - barW / 2;
    const by = this.y - 45;
    const hpFrac = Math.max(0, this.health) / this.maxHealth;

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(bx - 1, by - 1, barW + 2, barH + 2, 3);
    ctx.fill();

    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, barH, 2);
    ctx.fill();

    if (hpFrac > 0) {
      const grad = ctx.createLinearGradient(bx, by, bx + barW * hpFrac, by);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "#ffffff");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(bx, by, barW * hpFrac, barH, 2);
      ctx.fill();
    }
  }
}

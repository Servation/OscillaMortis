import { MAP_WIDTH, MAP_HEIGHT } from "../main";

export class SpellProjectile {
  public x: number;
  public y: number;
  public speedX: number;
  public speedY: number;
  public active: boolean = true;
  public type: "fire" | "poison" | "frost";
  public radius: number = 8;

  constructor(x: number, y: number, angle: number, type: "fire" | "poison" | "frost") {
    this.x = x;
    this.y = y;
    this.type = type;
    const speed = 7.0;
    this.speedX = Math.cos(angle) * speed;
    this.speedY = Math.sin(angle) * speed;
  }

  public update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x < 0 || this.x > MAP_WIDTH || this.y < 0 || this.y > MAP_HEIGHT) {
      this.active = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const color = this.type === "fire" ? "#f97316" :
                  this.type === "poison" ? "#22c55e" : "#3b82f6";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

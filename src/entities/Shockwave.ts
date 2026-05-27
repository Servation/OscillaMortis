import { Mob } from "./Mob";

export class Shockwave {
  public x: number;
  public y: number;
  public radius: number = 10;
  public maxRadius: number = 150;
  public speed: number = 8;
  public active: boolean = true;
  public hitMobs: Set<Mob> = new Set();

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public update() {
    this.radius += this.speed;
    if (this.radius >= this.maxRadius) {
      this.active = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.7)";
    ctx.lineWidth = 4 * (1 - this.radius / this.maxRadius) + 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

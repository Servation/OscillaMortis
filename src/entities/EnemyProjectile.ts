import { MAP_WIDTH, MAP_HEIGHT } from "../engine/Constants";

export class EnemyProjectile {
  public x: number;
  public y: number;
  public speedX: number;
  public speedY: number;
  public active: boolean = true;
  public damage: number;
  public readonly radius: number = 6;

  constructor(x: number, y: number, targetX: number, targetY: number, damage: number) {
    this.x = x;
    this.y = y;
    this.damage = damage;

    const angle = Math.atan2(targetY - y, targetX - x);
    const speed = 4.5;
    this.speedX = Math.cos(angle) * speed;
    this.speedY = Math.sin(angle) * speed;
  }

  public update(): void {
    this.x += this.speedX;
    this.y += this.speedY;

    // Deactivate if out of map bounds
    if (this.x < 0 || this.x > MAP_WIDTH || this.y < 0 || this.y > MAP_HEIGHT) {
      this.active = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, gameCounter: number): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(gameCounter * 0.1);
    
    ctx.fillStyle = "#e2e8f0"; // bone white
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;

    // Bone shape: central line with 4 circles at the ends
    ctx.fillRect(-8, -2, 16, 4);
    ctx.beginPath();
    ctx.arc(-8, -3, 3, 0, Math.PI * 2);
    ctx.arc(-8, 3, 3, 0, Math.PI * 2);
    ctx.arc(8, -3, 3, 0, Math.PI * 2);
    ctx.arc(8, 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

import { MAP_WIDTH, MAP_HEIGHT } from "../engine/Constants";
import { sound } from "../engine/Sound";
import { Player } from "./Player";

export class CoinDrop {
  public x: number;
  public y: number;
  public speedX: number;
  public speedY: number;
  public active: boolean = true;
  public value: number;
  public friction: number = 0.95;
  public life: number = 600; // 10 seconds at 60fps
  public sparkleTimer: number = 0;

  constructor(x: number, y: number, value: number) {
    this.x = x;
    this.y = y;
    this.value = value;
    const angle = Math.random() * Math.PI * 2;
    const force = 2.0 + Math.random() * 4.0;
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
      player.Coin += this.value;
      this.active = false;
      sound.play("coin_pickup", 0.3);
    }

    this.life--;
    if (this.life <= 0) {
      this.active = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, gameCounter: number) {
    ctx.save();
    if (this.life < 120) {
      ctx.globalAlpha = this.life / 120;
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 6, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(gameCounter * 0.1 + this.sparkleTimer) * 2;

    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y + bob, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if ((gameCounter + this.sparkleTimer) % 60 < 10) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(this.x + 2, this.y - 2 + bob, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

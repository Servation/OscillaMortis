import type { Player } from "../Player";
import type { Mob } from "../Mob";

export function ghostRunAI(
  z: Mob,
  player: Player,
  resonator: { x: number; y: number; health: number; takeDamage: (amount: number) => void } | null,
  counter: number,
  playSoundCallback: (sound: string) => void
): void {
  let target = { x: player.x, y: player.y, width: 61, height: 64 };
  let actualTargetType: "player" | "resonator" = "player";

  if (z.aggroTarget === "resonator" && resonator && resonator.health > 0) {
    target = { x: resonator.x - 28, y: resonator.y - 28, width: 56, height: 56 };
    actualTargetType = "resonator";
  }

  const tx = actualTargetType === "resonator" ? target.x + target.width / 2 : player.x + 15;
  const ty = actualTargetType === "resonator" ? target.y + target.height / 2 : player.y + 30;

  if (z.playZomSound) {
    playSoundCallback("ghost_aggro");
    z.playZomSound = false;
  }

  // --- Ghost Sine Wave Float AI ---
  const dx = tx - (z.x + 15);
  const dy = ty - (z.y + 30);
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const dirX = dx / dist;
  const dirY = dy / dist;

  // Perpendicular vector for wiggling
  const perpX = -dirY;
  const perpY = dirX;
  const wiggle = Math.sin(counter * 0.12) * 1.6;

  z.speedX = dirX * z.maxSpeedVal + perpX * wiggle;
  z.speedY = dirY * z.maxSpeedVal + perpY * wiggle;
  z.moving = true;
  z.direct = dirX > 0 ? 27 : 9;

  // Record position history for afterimage trail (max 4 frames)
  if (counter % 3 === 0) {
    z.posHistory.push({ x: z.x, y: z.y });
    if (z.posHistory.length > 4) {
      z.posHistory.shift();
    }
  }
}

export function drawGhost(z: Mob, ctx: CanvasRenderingContext2D): void {
  // Draw afterimage trail
  for (let i = 0; i < z.posHistory.length; i++) {
    const pos = z.posHistory[i];
    const alpha = (i / z.posHistory.length) * 0.2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(pos.x + 30, pos.y + 32);
    ctx.scale(z.scale, z.scale);
    ctx.translate(-(pos.x + 30), -(pos.y + 32));

    const sx = (z.direct % 9) * 64;
    const sy = 505 + Math.floor(z.direct / 9) * 63;
    ctx.drawImage(z.spriteSheet, sx, sy, 62, 63, pos.x, pos.y, 61, 64);
    ctx.restore();
  }

  // Main ghost body
  ctx.save();
  ctx.translate(z.x + 30, z.y + 32);
  ctx.scale(z.scale, z.scale);
  ctx.translate(-(z.x + 30), -(z.y + 32));

  // Pulsing glow aura
  const glowSize = 35 + Math.sin(Date.now() * 0.005) * 5;
  ctx.fillStyle = "rgba(168, 85, 247, 0.08)";
  ctx.beginPath();
  ctx.arc(z.x + 30, z.y + 32, glowSize, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.55;
  ctx.shadowColor = "rgba(168, 85, 247, 0.6)";
  ctx.shadowBlur = 12;

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.beginPath();
  ctx.ellipse(z.x + 30, z.y + 52, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (z.isAtk) {
    const dirGroup = z.getDirectionGroup();
    const frameIndex = dirGroup * 6 + z.atkCounter;
    const sx = (frameIndex % 6) * 63;
    const sy = 759 + Math.floor(frameIndex / 6) * 63;
    ctx.drawImage(z.spriteSheet, sx, sy, 60, 63, z.x, z.y - 4, 61, 64);
  } else {
    const sx = (z.direct % 9) * 64;
    const sy = 505 + Math.floor(z.direct / 9) * 63;
    ctx.drawImage(z.spriteSheet, sx, sy, 62, 63, z.x, z.y, 61, 64);
  }
  ctx.restore();

  // Health bar
  z.drawHealthBar(ctx, z.x + 5, z.y - 8, 50);
}

import type { Player } from "../Player";
import type { Mob } from "../Mob";

export function skeletonRunAI(
  z: Mob,
  player: Player,
  resonator: { x: number; y: number; health: number; takeDamage: (amount: number) => void } | null,
  _counter: number,
  playSoundCallback: (sound: string) => void,
  spawnProjectileCallback?: (sx: number, sy: number, tx: number, ty: number) => void
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
    playSoundCallback("skeleton_aggro");
    z.playZomSound = false;
  }

  // --- Skeleton Ranged AI ---
  const dx = tx - (z.x + 15);
  const dy = ty - (z.y + 30);
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const dirX = dx / dist;
  const dirY = dy / dist;

  if (dist < 180) {
    // Retreat
    z.speedX = -dirX * z.maxSpeedVal;
    z.speedY = -dirY * z.maxSpeedVal;
    z.moving = true;
  } else if (dist > 250) {
    // Advance
    z.speedX = dirX * z.maxSpeedVal;
    z.speedY = dirY * z.maxSpeedVal;
    z.moving = true;
  } else {
    // Orbit
    const perpX = -dirY;
    const perpY = dirX;
    z.speedX = perpX * z.maxSpeedVal;
    z.speedY = perpY * z.maxSpeedVal;
    z.moving = true;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    z.direct = dirX > 0 ? 27 : 9;
  } else {
    z.direct = dirY > 0 ? 18 : 0;
  }

  // Ranged bone throwing
  if (z.shootCooldown > 0) {
    z.shootCooldown--;
  } else if (spawnProjectileCallback) {
    z.shootCooldown = 120 + Math.random() * 40;
    spawnProjectileCallback(z.x + 15, z.y + 30, tx, ty);
  }
}

export function drawSkeleton(z: Mob, ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(z.x + 30, z.y + 32);
  ctx.scale(z.scale, z.scale);
  ctx.translate(-(z.x + 30), -(z.y + 32));

  const cx = z.x + 30;
  const dirGroup = z.getDirectionGroup(); // 0 = UP, 1 = LEFT, 2 = DOWN, 3 = RIGHT

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(cx, z.y + 55, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Skull
  ctx.fillStyle = "#e2e8f0";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, z.y + 8, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Jaw and Eyes (direction-dependent)
  if (dirGroup === 0) {
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(cx - 5, z.y + 14, 10, 4);
  } else if (dirGroup === 2) {
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(cx - 6, z.y + 15, 12, 5);

    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(cx - 4, z.y + 6, 3, 0, Math.PI * 2);
    ctx.arc(cx + 4, z.y + 6, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(cx - 4, z.y + 6, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 4, z.y + 6, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (dirGroup === 1) {
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(cx - 9, z.y + 15, 8, 5);

    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(cx - 5, z.y + 6, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(cx - 5, z.y + 6, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (dirGroup === 3) {
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(cx + 1, z.y + 15, 8, 5);

    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(cx + 5, z.y + 6, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(cx + 5, z.y + 6, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spine
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, z.y + 18);
  ctx.lineTo(cx, z.y + 42);
  ctx.stroke();

  // Ribs
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const ry = z.y + 22 + i * 6;
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
  const swing = z.moving ? Math.sin(z.tickCounter * 0.25) * 6 : 0;

  // Arms
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (dirGroup === 1) {
    // Facing LEFT
    // Left arm
    ctx.moveTo(cx, z.y + 22);
    ctx.lineTo(cx - 14 + swing, z.y + 33 + swing * 0.5);
    ctx.stroke();

    // Right arm
    ctx.beginPath();
    ctx.strokeStyle = "#cbd5e1";
    ctx.moveTo(cx - 2, z.y + 22);
    ctx.lineTo(cx + 5 - swing, z.y + 31 - swing * 0.5);
    ctx.stroke();
    ctx.strokeStyle = "#e2e8f0";
  } else if (dirGroup === 3) {
    // Facing RIGHT
    // Right arm
    ctx.moveTo(cx, z.y + 22);
    ctx.lineTo(cx + 14 - swing, z.y + 33 - swing * 0.5);
    ctx.stroke();

    // Left arm
    ctx.beginPath();
    ctx.strokeStyle = "#cbd5e1";
    ctx.moveTo(cx + 2, z.y + 22);
    ctx.lineTo(cx - 5 + swing, z.y + 31 + swing * 0.5);
    ctx.stroke();
    ctx.strokeStyle = "#e2e8f0";
  } else {
    // Facing UP/DOWN
    // Left arm
    ctx.moveTo(cx, z.y + 22);
    ctx.lineTo(cx - 14, z.y + 35 + swing);
    ctx.stroke();

    // Right arm
    ctx.beginPath();
    ctx.moveTo(cx, z.y + 22);
    ctx.lineTo(cx + 14, z.y + 35 - swing);
    ctx.stroke();
  }

  // Legs
  ctx.beginPath();
  if (dirGroup === 1 || dirGroup === 3) {
    // Left leg
    ctx.moveTo(cx, z.y + 42);
    ctx.lineTo(cx - 8 + swing, z.y + 58 - Math.abs(swing) * 0.3);
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(cx, z.y + 42);
    ctx.lineTo(cx + 8 - swing, z.y + 58 - Math.abs(swing) * 0.3);
    ctx.stroke();
  } else {
    // Left leg
    ctx.moveTo(cx, z.y + 42);
    ctx.lineTo(cx - 8 + swing, z.y + 58 - Math.abs(swing) * 0.3);
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(cx, z.y + 42);
    ctx.lineTo(cx + 8 - swing, z.y + 58 - Math.abs(swing) * 0.3);
    ctx.stroke();
  }

  // Joints
  ctx.fillStyle = "#f1f5f9";
  let joints: [number, number][] = [];
  if (dirGroup === 1) {
    joints = [
      [cx - 14 + swing, z.y + 33 + swing * 0.5],
      [cx + 5 - swing, z.y + 31 - swing * 0.5],
      [cx - 8 + swing, z.y + 58 - Math.abs(swing) * 0.3],
      [cx + 8 - swing, z.y + 58 - Math.abs(swing) * 0.3]
    ];
  } else if (dirGroup === 3) {
    joints = [
      [cx - 5 + swing, z.y + 31 + swing * 0.5],
      [cx + 14 - swing, z.y + 33 - swing * 0.5],
      [cx - 8 + swing, z.y + 58 - Math.abs(swing) * 0.3],
      [cx + 8 - swing, z.y + 58 - Math.abs(swing) * 0.3]
    ];
  } else {
    joints = [
      [cx - 14, z.y + 35 + swing],
      [cx + 14, z.y + 35 - swing],
      [cx - 8 + swing, z.y + 58 - Math.abs(swing) * 0.3],
      [cx + 8 - swing, z.y + 58 - Math.abs(swing) * 0.3]
    ];
  }
  for (const [jx, jy] of joints) {
    ctx.beginPath();
    ctx.arc(jx, jy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Health bar
  z.drawHealthBar(ctx, z.x + 5, z.y - 8, 50);
}

import type { Player } from "../Player";
import type { Mob } from "../Mob";

export function slimeRunAI(
  z: Mob,
  player: Player,
  resonator: { x: number; y: number; radius: number; health: number; takeDamage: (amount: number) => void } | null,
  _counter: number,
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
    playSoundCallback("slime_aggro");
    z.playZomSound = false;
  }

  // --- Slime Jump/Bounce AI ---
  if (z.slimeRestTicks > 0 && z.slimeJumpTicks === 0) {
    z.slimeRestTicks--;
    z.speedX = 0;
    z.speedY = 0;
    z.moving = false;
    if (z.slimeRestTicks === 0) {
      z.slimeJumpTicks = 35;
      const dx = tx - (z.x + 15);
      const dy = ty - (z.y + 30);
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      z.slimeJumpDirX = dx / len;
      z.slimeJumpDirY = dy / len;
    }
  }

  if (z.slimeJumpTicks > 0) {
    let jumpSpeed = z.isMinislime ? 3.2 : 2.2;
    if (z.freezeTicks > 0) jumpSpeed *= 0.4;
    if (z.isFrozenBlock) jumpSpeed = 0;
    z.speedX = z.slimeJumpDirX * jumpSpeed;
    z.speedY = z.slimeJumpDirY * jumpSpeed;
    z.moving = true;
    z.direct = z.slimeJumpDirX > 0 ? 27 : 9;
    z.slimeJumpTicks--;
    if (z.slimeJumpTicks === 0) {
      z.slimeRestTicks = Math.floor(Math.random() * 30) + 40;
    }
  }

  // Touch attack damage check
  if (z.touchDamageCooldown === 0) {
    const zCx = z.x + 30;
    const zCy = z.y + 40;
    if (actualTargetType === "resonator" && resonator) {
      const dx = zCx - resonator.x;
      const dy = zCy - resonator.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < resonator.radius + 14) {
        resonator.takeDamage(z.damage);
        z.touchDamageCooldown = 60; // 1s cooldown
      }
    } else {
      const dx = zCx - (player.x + 15);
      const dy = zCy - (player.y + 30);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 28) {
        player.takeDamage(z.damage);
        z.touchDamageCooldown = 60; // 1s cooldown

        // Apply status effect based on slime type
        if (z.mobType === "fire_slime" || z.mobType === "fire_minislime") {
          player.fireTicks = Math.max(player.fireTicks, 180); // 3 seconds
        } else if (z.mobType === "frost_slime" || z.mobType === "frost_minislime") {
          player.frostTicks = Math.max(player.frostTicks, 150); // 2.5 seconds
        } else if (z.mobType === "poison_slime" || z.mobType === "poison_minislime") {
          player.poisonTicks = Math.max(player.poisonTicks, 210); // 3.5 seconds
        }
      }
    }
  }
}

export function slimeWanderAI(z: Mob): void {
  // Slime bouncy wandering
  if (z.slimeRestTicks > 0 && z.slimeJumpTicks === 0) {
    z.slimeRestTicks--;
    z.speedX = 0;
    z.speedY = 0;
    z.moving = false;
    if (z.slimeRestTicks === 0) {
      z.slimeJumpTicks = 35;
      const angle = Math.random() * Math.PI * 2;
      z.slimeJumpDirX = Math.cos(angle);
      z.slimeJumpDirY = Math.sin(angle);
    }
  }
  if (z.slimeJumpTicks > 0) {
    let jumpSpeed = z.isMinislime ? 1.6 : 1.0;
    if (z.freezeTicks > 0) jumpSpeed *= 0.4;
    if (z.isFrozenBlock) jumpSpeed = 0;
    z.speedX = z.slimeJumpDirX * jumpSpeed;
    z.speedY = z.slimeJumpDirY * jumpSpeed;
    z.moving = true;
    z.direct = z.slimeJumpDirX > 0 ? 27 : 9;
    z.slimeJumpTicks--;
    if (z.slimeJumpTicks === 0) {
      z.slimeRestTicks = Math.floor(Math.random() * 40) + 60;
    }
  }
}

export function drawSlime(
  z: Mob,
  ctx: CanvasRenderingContext2D,
  color: string,
  outlineColor: string
): void {
  // Squash/stretch factor
  let squashX = 1.0;
  let stretchY = 1.0;

  if (z.slimeJumpTicks > 0) {
    // In the middle of a jump: stretched vertically
    stretchY = 1.15;
    squashX = 0.85;
  } else {
    // Preparing to jump or resting: squashed horizontally/flat
    const readyFactor = z.slimeRestTicks; // rest ticks left (0 to restMax)
    if (readyFactor < 15) {
      // Deep squash right before jump
      squashX = 1.25;
      stretchY = 0.75;
    } else {
      // Soft breathe effect
      const breathe = Math.sin(z.tickCounter * 0.1) * 0.03;
      squashX = 1.0 + breathe;
      stretchY = 1.0 - breathe;
    }
  }

  const rx = 24 * squashX * z.scale;
  const ry = 18 * stretchY * z.scale;
  const cx = z.x + 30;
  const cy = z.y + 40;

  const dirGroup = z.getDirectionGroup(); // 0 = UP, 1 = LEFT, 2 = DOWN, 3 = RIGHT

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
  if (z.mobType === "minislime") {
    nucleusColor = "rgba(29, 78, 216, 0.6)"; // standard blue minislime
  } else if (z.mobType === "fire_slime" || z.mobType === "fire_minislime") {
    nucleusColor = "rgba(234, 88, 12, 0.7)"; // dark orange/red core
  } else if (z.mobType === "frost_slime" || z.mobType === "frost_minislime") {
    nucleusColor = "rgba(8, 145, 178, 0.7)"; // dark cyan/blue core
  } else if (z.mobType === "poison_slime" || z.mobType === "poison_minislime") {
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

    let eyeSizeW = 2.5 * z.scale;
    let eyeSizeH = 4 * z.scale;
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
  z.drawHealthBar(ctx, cx - 22, cy - ry - 10, 44);
}

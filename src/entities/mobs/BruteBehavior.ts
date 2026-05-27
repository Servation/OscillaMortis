import { checkRectCollision } from "../../engine/Collision";
import type { Player } from "../Player";
import type { Mob } from "../Mob";

export function bruteRunAI(
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
    playSoundCallback("brute_aggro");
    z.playZomSound = false;
  }

  // --- Brute Charger AI ---
  if (z.bruteChargeCooldown > 0) {
    z.bruteChargeCooldown--;

    const reachedLR = z.chaseLR(target);
    const reachedTB = z.chaseTB(target);
    if (reachedLR && reachedTB && !z.moving) {
      z.isAtk = true;
      z.performAttack(player, resonator, actualTargetType, counter);
    } else {
      z.isAtk = false;
    }
    if (z.bruteChargeCooldown <= 0) {
      z.brutePrepTicks = 45; // 0.75s freeze prep
      z.speedX = 0;
      z.speedY = 0;
      z.moving = false;
    }
  } else if (z.brutePrepTicks > 0) {
    z.brutePrepTicks--;
    z.speedX = 0;
    z.speedY = 0;
    z.moving = false;
    // Face target in prep
    const dx = tx - z.x;
    z.direct = dx > 0 ? 27 : 9;

    if (z.brutePrepTicks === 0) {
      z.bruteChargeTicks = 40; // 0.6s dash
      const dxC = tx - (z.x + 15);
      const dyC = ty - (z.y + 30);
      const dist = Math.sqrt(dxC * dxC + dyC * dyC) || 1;
      z.chargeDirX = dxC / dist;
      z.chargeDirY = dyC / dist;
    }
  } else if (z.bruteChargeTicks > 0) {
    let chargeSpeed = 5.2;
    if (z.freezeTicks > 0) chargeSpeed *= 0.4;
    if (z.isFrozenBlock) chargeSpeed = 0;
    z.speedX = z.chargeDirX * chargeSpeed;
    z.speedY = z.chargeDirY * chargeSpeed;
    z.moving = true;
    z.direct = z.chargeDirX > 0 ? 27 : 9;

    z.bruteChargeTicks--;
    if (z.bruteChargeTicks === 0) {
      z.bruteChargeCooldown = 200 + Math.random() * 60;
    }

    // Damage check during charge dash
    const hitbox = z.getAttackHitbox();
    const hit = actualTargetType === "resonator" ? checkRectCollision(
      hitbox.x, hitbox.y, hitbox.w, hitbox.h,
      target.x, target.y, target.width, target.height
    ) : checkRectCollision(
      hitbox.x, hitbox.y, hitbox.w, hitbox.h,
      player.x + 15, player.y, 30, 60
    );
    if (hit) {
      if (actualTargetType === "resonator" && resonator) {
        resonator.takeDamage(z.damage * 1.5);
      } else {
        player.takeDamage(z.damage * 1.5); // Extra crash damage
      }
    }
  }
}

import type { Player } from "../Player";
import type { Mob } from "../Mob";

export function walkerRunAI(
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

  if (z.playZomSound) {
    const soundName = z.mobType === "runner" ? "runner_aggro" : "zombie";
    playSoundCallback(soundName);
    z.playZomSound = false;
  }

  // --- Standard Zombie Chase ---
  const reachedLR = z.chaseLR(target);
  const reachedTB = z.chaseTB(target);

  if (reachedLR && reachedTB && !z.moving) {
    z.isAtk = true;
    z.performAttack(player, resonator, actualTargetType, counter);
  } else {
    z.isAtk = false;
  }
}

import { Player, type WeaponType } from "./Player";

export interface ShopItem {
  type: "weapon" | "consumable";
  name: string;
  cost: number;
  tier: 1 | 2 | 3;
  purchased: boolean;
  weaponType?: WeaponType;
  consumableType?: string;
  description?: string;
  onBuy?: (player: Player) => string;
}

export interface ShopStand {
  x: number;
  y: number;
  w: number;
  h: number;
  item: ShopItem | null;
}

export interface ConsumableItem {
  name: string;
  consumableType: string;
  tier: 1 | 2 | 3;
  cost: number;
  weight: number;
  description: string;
  onBuy: (player: Player) => string;
}

export interface WeaponItem {
  weaponType: WeaponType;
  cost: number;
  tier: 1 | 2 | 3;
  weight: number;
}

export const WEAPON_ITEMS: WeaponItem[] = [
  { weaponType: "Short Sword", cost: 15, tier: 1, weight: 35 },
  { weaponType: "Wooden Club", cost: 20, tier: 1, weight: 25 },
  { weaponType: "Iron Sword", cost: 40, tier: 2, weight: 20 },
  { weaponType: "Baseball Bat", cost: 50, tier: 2, weight: 10 },
  { weaponType: "Machete", cost: 75, tier: 3, weight: 7 },
  { weaponType: "Fire Axe", cost: 110, tier: 3, weight: 3 }
];

export const CONSUMABLE_ITEMS: ConsumableItem[] = [
  {
    name: "Health Elixir",
    consumableType: "health_1",
    tier: 1,
    cost: 10,
    weight: 45,
    description: "Heals +35 HP",
    onBuy: (player) => {
      player.Health = Math.min(100, player.Health + 35);
      return "HEALED +35 HP!";
    }
  },
  {
    name: "Greater Health Elixir",
    consumableType: "health_2",
    tier: 2,
    cost: 22,
    weight: 20,
    description: "Heals +75 HP",
    onBuy: (player) => {
      player.Health = Math.min(100, player.Health + 75);
      return "HEALED +75 HP!";
    }
  },
  {
    name: "Tome of Wrath",
    consumableType: "spelltome_aoe",
    tier: 1,
    cost: 10,
    weight: 25,
    description: "AOE Blast tome",
    onBuy: (player) => {
      player.tomes.aoe++;
      return "PURCHASED WRATH TOME (+1)!";
    }
  },
  {
    name: "Tome of Fire",
    consumableType: "spelltome_fire",
    tier: 2,
    cost: 14,
    weight: 20,
    description: "Fire DOT tome",
    onBuy: (player) => {
      player.tomes.fire++;
      return "PURCHASED FIRE TOME (+1)!";
    }
  },
  {
    name: "Tome of Poison",
    consumableType: "spelltome_poison",
    tier: 2,
    cost: 12,
    weight: 20,
    description: "Poison DOT tome",
    onBuy: (player) => {
      player.tomes.poison++;
      return "PURCHASED POISON TOME (+1)!";
    }
  },
  {
    name: "Tome of Frost",
    consumableType: "spelltome_frost",
    tier: 2,
    cost: 15,
    weight: 18,
    description: "Freeze slow/block tome",
    onBuy: (player) => {
      player.tomes.frost++;
      return "PURCHASED FROST TOME (+1)!";
    }
  },
  {
    name: "Iron Skin Brew",
    consumableType: "ironskin",
    tier: 2,
    cost: 18,
    weight: 15,
    description: "+25% Def for Next Wave",
    onBuy: (player) => {
      player.damageReduction = 0.25;
      return "IRONSKIN ACTIVE (25% DEF)!";
    }
  },
  {
    name: "Swiftness Draught",
    consumableType: "swiftness",
    tier: 2,
    cost: 18,
    weight: 15,
    description: "+30% Speed for Next Wave",
    onBuy: (player) => {
      player.speedBoost = 0.30;
      return "SWIFTNESS ACTIVE (30% SPEED)!";
    }
  },
  {
    name: "Spell Book of Power",
    consumableType: "spellbook",
    tier: 3,
    cost: 45,
    weight: 8,
    description: "Permanent +25% Magic DMG",
    onBuy: (player) => {
      player.magicDamageMultiplier += 0.25;
      return "PERMANENT MAGIC DAMAGE +25%!";
    }
  },
  {
    name: "Energy Tonic",
    consumableType: "energy",
    tier: 2,
    cost: 18,
    weight: 15,
    description: "+300% Energy Regen",
    onBuy: (player) => {
      player.energyRegenRate = 0.45; // 0.45 per tick
      return "ENERGY TONIC ACTIVE (+300% REGEN)!";
    }
  }
];

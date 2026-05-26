export interface ShopItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  description: string;
  iconName: string;
}

export class ShopSystem {
  private items: ShopItem[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.items = [
      {
        id: "strPlus",
        name: "Strength +",
        price: 50,
        quantity: 5,
        description: "Increase attack damage multiplier by +0.25x",
        iconName: "icons8-strength-100.png",
      },
      {
        id: "fullHeal",
        name: "Full Heal",
        price: 20,
        quantity: 99,
        description: "Restore your Health to maximum (100 HP)",
        iconName: "icons8-heart-64.png",
      },
      {
        id: "EnergyRen",
        name: "Energy Regen",
        price: 40,
        quantity: 5,
        description: "Increase Energy recovery rate by +0.02 units/tick",
        iconName: "icons8-lightning-bolt-80.png",
      },
    ];
  }

  public getItems(): ShopItem[] {
    return this.items;
  }

  public getItem(id: string): ShopItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  public buyItem(id: string, coins: number): { success: boolean; cost: number; error?: string } {
    const item = this.getItem(id);
    if (!item) {
      return { success: false, cost: 0, error: "Item not found" };
    }

    if (item.quantity <= 0) {
      return { success: false, cost: 0, error: "Item out of stock" };
    }

    if (coins < item.price) {
      return { success: false, cost: 0, error: "Not enough coins" };
    }

    item.quantity -= 1;
    return { success: true, cost: item.price };
  }
}

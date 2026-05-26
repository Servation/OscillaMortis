export class Keyboard {
  private pressedKeys: Set<string> = new Set();

  constructor() {
    window.addEventListener("keydown", (e) => {
      this.pressedKeys.add(e.key.toLowerCase());
      this.pressedKeys.add(e.code.toLowerCase()); // Support key codes like Space/Shift
    });

    window.addEventListener("keyup", (e) => {
      this.pressedKeys.delete(e.key.toLowerCase());
      this.pressedKeys.delete(e.code.toLowerCase());
    });
  }

  public isPressed(key: string): boolean {
    return this.pressedKeys.has(key.toLowerCase());
  }

  public clear(): void {
    this.pressedKeys.clear();
  }
}

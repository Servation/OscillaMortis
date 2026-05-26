
export class UIManager {
  private startScreen: HTMLElement;
  private gameOverScreen: HTMLElement;
  private interactPrompt: HTMLElement;

  private finalCoins: HTMLElement;
  private finalZombies: HTMLElement;

  constructor() {
    this.startScreen = document.getElementById("start-screen")!;
    this.gameOverScreen = document.getElementById("game-over-screen")!;
    this.interactPrompt = document.getElementById("interact-prompt")!;
    this.finalCoins = document.getElementById("final-coins")!;
    this.finalZombies = document.getElementById("final-zombies")!;
  }

  public showStartScreen(onStart: () => void): void {
    this.startScreen.classList.remove("hidden");
    this.gameOverScreen.classList.add("hidden");
    this.interactPrompt.classList.add("hidden");

    const startBtn = document.getElementById("btn-start")!;
    // Remove previous listeners
    const newStartBtn = startBtn.cloneNode(true) as HTMLButtonElement;
    startBtn.parentNode!.replaceChild(newStartBtn, startBtn);

    newStartBtn.addEventListener("click", () => {
      this.startScreen.classList.add("hidden");
      onStart();
    });
  }

  public showInteractPrompt(visible: boolean, text: string = "Press F to Enter Shop"): void {
    if (visible) {
      this.interactPrompt.classList.remove("hidden");
      this.interactPrompt.innerHTML = text;
    } else {
      this.interactPrompt.classList.add("hidden");
    }
  }

  public showGameOver(coins: number, totalZombies: number, onRestart: () => void): void {
    this.gameOverScreen.classList.remove("hidden");
    this.finalCoins.innerText = coins.toString();
    this.finalZombies.innerText = totalZombies.toString();

    const restartBtn = document.getElementById("btn-restart")!;
    const newRestartBtn = restartBtn.cloneNode(true) as HTMLButtonElement;
    restartBtn.parentNode!.replaceChild(newRestartBtn, restartBtn);

    newRestartBtn.addEventListener("click", () => {
      this.gameOverScreen.classList.add("hidden");
      onRestart();
    });
  }
}

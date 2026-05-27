import { Keyboard } from "./engine/Keyboard";
import { UIManager } from "./components/UI";
import { Game } from "./engine/Game";
import { preloadAssets } from "./engine/Assets";
import { MAP_WIDTH, MAP_HEIGHT } from "./engine/Constants";
import "./style.css";

// Setup Canvas
const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
canvas.width = MAP_WIDTH;
canvas.height = MAP_HEIGHT;

// Core Engines & State
const keyboard = new Keyboard();
const ui = new UIManager();
const game = new Game(canvas, keyboard, ui);

// Main Animation Frame loop
function gameLoop() {
  game.updatePhysics();
  game.drawGame();
  requestAnimationFrame(gameLoop);
}

// Start boot flow
async function start() {
  try {
    await preloadAssets();

    ui.showStartScreen(() => {
      game.initGame();
      game.gameStarted = true;
    });

    requestAnimationFrame(gameLoop);
  } catch (err) {
    console.error("Critical error starting game:", err);
  }
}

start();

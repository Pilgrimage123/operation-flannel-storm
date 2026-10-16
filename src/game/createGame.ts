import * as Phaser from "phaser";
import { bus } from "./eventBus";
import { GameScene } from "./GameScene";

export function createGame(parent: string) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#1a2214",
    pixelArt: false,
    roundPixels: true,
    banner: false,
    audio: { noAudio: true },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 540,
    },
    scene: [],
    input: { keyboard: true },
  });

  game.scene.add("game", GameScene, false);

  const boot = () => {
    if (game.scene.isActive("game") || game.scene.isPaused("game")) {
      game.scene.stop("game");
    }
    game.scene.start("game");
  };
  const quit = () => {
    if (game.scene.isActive("game") || game.scene.isPaused("game")) {
      game.scene.stop("game");
    }
  };

  const onDeploy = () => boot();
  const onQuit = () => quit();
  bus.on("deploy", onDeploy);
  bus.on("quit", onQuit);

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    bus.off("deploy", onDeploy);
    bus.off("quit", onQuit);
  });

  bus.emit("engine-ready", null);
  return game;
}

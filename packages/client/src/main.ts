import Phaser from "phaser";
import GameScene from "./scenes/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#05070b",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540
  },
  physics: {
    default: "matter",
    matter: { gravity: { x: 0, y: 0 }, debug: false }
  },
  scene: [GameScene]
};

export default new Phaser.Game(config);


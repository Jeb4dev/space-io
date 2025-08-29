import Phaser from "phaser";

/**
 * Simple starfield: two generated textures, tiled as layers.
 * Robust against missing-texture issues (no RenderTexture.draw overload quirks).
 */
export default class Parallax {
  private layer1!: Phaser.GameObjects.TileSprite;
  private layer2!: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene) {
    // 1) Create textures up-front
    createStarTexture(scene, "stars1", 512, 512, 80, 1, 2);
    createStarTexture(scene, "stars2", 512, 512, 40, 1, 3);

    const w = scene.scale.width;
    const h = scene.scale.height;

    // 2) Build layers using the generated textures
    this.layer1 = scene.add.tileSprite(0, 0, w, h, "stars1").setOrigin(0, 0).setScrollFactor(0);
    this.layer2 = scene.add.tileSprite(0, 0, w, h, "stars2").setOrigin(0, 0).setScrollFactor(0).setAlpha(0.7);
  }

  update(vx: number, vy: number) {
    this.layer1.tilePositionX += vx * 0.02;
    this.layer1.tilePositionY += vy * 0.02;
    this.layer2.tilePositionX += vx * 0.04;
    this.layer2.tilePositionY += vy * 0.04;
  }
}

function createStarTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  count: number,
  minR: number,
  maxR: number
) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 1);
  g.fillRect(0, 0, w, h);
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < count; i++) {
    const r = minR + Math.random() * (maxR - minR);
    g.fillCircle(Math.random() * w, Math.random() * h, r);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

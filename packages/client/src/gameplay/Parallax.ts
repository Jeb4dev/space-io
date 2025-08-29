import Phaser from "phaser";

export class Parallax {
  private g1: Phaser.GameObjects.TileSprite;
  private g2: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene) {
    const w = scene.scale.width;
    const h = scene.scale.height;
    this.g1 = scene.add.tileSprite(0, 0, w, h, "").setOrigin(0, 0);
    this.g2 = scene.add.tileSprite(0, 0, w, h, "").setOrigin(0, 0);

    // generate star textures
    const rt1 = scene.add.renderTexture(0, 0, 256, 256).setVisible(false);
    const rt2 = scene.add.renderTexture(0, 0, 256, 256).setVisible(false);
    for (let i = 0; i < 70; i++) {
      rt1.draw(this.star(scene, 1 + Math.random() * 2), Math.random() * 256, Math.random() * 256);
    }
    for (let i = 0; i < 40; i++) {
      rt2.draw(this.star(scene, 1 + Math.random() * 3), Math.random() * 256, Math.random() * 256);
    }
    rt1.saveTexture("stars1");
    rt2.saveTexture("stars2");
    this.g1.setTexture("stars1");
    this.g2.setTexture("stars2");
    rt1.destroy(); rt2.destroy();
    this.g2.setAlpha(0.7);
  }

  private star(scene: Phaser.Scene, r: number) {
    const g = scene.add.graphics().fillStyle(0xffffff, 1).fillCircle(0, 0, r);
    const rt = scene.add.renderTexture(0, 0, r * 2 + 2, r * 2 + 2).setVisible(false);
    rt.draw(g, r + 1, r + 1);
    const key = "star_" + Math.random();
    rt.saveTexture(key);
    g.destroy(); rt.destroy();
    return key;
  }

  update(vx: number, vy: number) {
    this.g1.tilePositionX += vx * 0.02;
    this.g1.tilePositionY += vy * 0.02;
    this.g2.tilePositionX += vx * 0.04;
    this.g2.tilePositionY += vy * 0.04;
  }
}

export default Parallax;


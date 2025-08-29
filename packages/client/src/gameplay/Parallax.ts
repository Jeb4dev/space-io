import Phaser from "phaser";

/**
 * Two-layer starfield with gentle parallax and EMA smoothing.
 * World units ~= pixels; we scale by dt so motion is frame-rate independent.
 */
export default class Parallax {
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;

  // tunables
  private farFactor: number;
  private nearFactor: number;
  private smoothing: number; // 0..1, higher = smoother (more inertial)

  // smoothed velocity
  private vxE = 0;
  private vyE = 0;

  constructor(
    scene: Phaser.Scene,
    opts: { farFactor?: number; nearFactor?: number; smoothing?: number } = {}
  ) {
    // Defaults: very gentle drift. Near just a touch faster than far.
    this.farFactor = opts.farFactor ?? 0.06;
    this.nearFactor = opts.nearFactor ?? 0.10;
    this.smoothing = opts.smoothing ?? 0.85;

    // Generate textures once
    createStarTexture(scene, "stars_far", 512, 512, 70, 1, 2);  // fine dust
    createStarTexture(scene, "stars_near", 512, 512, 40, 1, 3); // brighter stars

    const w = scene.scale.width;
    const h = scene.scale.height;

    this.far = scene.add
      .tileSprite(0, 0, w, h, "stars_far")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(0);

    this.near = scene.add
      .tileSprite(0, 0, w, h, "stars_near")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setAlpha(0.75)
      .setDepth(1);
  }

  /** Adjust how strong the layers react to velocity (can be called live). */
  setSpeeds(farFactor: number, nearFactor: number) {
    this.farFactor = farFactor;
    this.nearFactor = nearFactor;
  }

  /**
   * Update with your current world velocity.
   * @param vx world vx (px/sec)
   * @param vy world vy (px/sec)
   * @param dtMs optional frame delta; if omitted we assume ~60 FPS
   */
  update(vx: number, vy: number, dtMs: number = 1000 / 60) {
    // Exponential moving average to kill jitter
    const a = 1 - this.smoothing; // blend factor
    this.vxE += (vx - this.vxE) * a;
    this.vyE += (vy - this.vyE) * a;

    const dt = Math.max(0, dtMs) / 1000;

    // Very gentle parallax; camera is fixed, so we offset tiles opposite velocity
    this.far.tilePositionX += this.vxE * this.farFactor * dt;
    this.far.tilePositionY += this.vyE * this.farFactor * dt;

    this.near.tilePositionX += this.vxE * this.nearFactor * dt;
    this.near.tilePositionY += this.vyE * this.nearFactor * dt;
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

import type { PowerupChoice } from "@shared/types";

export class LevelUpModal {
  root: HTMLDivElement;

  constructor() {
    const overlay = document.createElement("div");
    overlay.className = "ui-overlay";
    const modal = document.createElement("div");
    modal.className = "modal level-up-modal";
    modal.innerHTML = `
      <h2>Level Up!</h2>
      <p>Choose a powerup to improve by +1 level</p>
      <div class="powerup-choices"></div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.root = overlay;
    this.hide();
  }

  hide() {
    this.root.style.display = "none";
  }

  show() {
    this.root.style.display = "flex";
  }

  async choose(choices: PowerupChoice[], currentStats?: any): Promise<PowerupChoice> {
    this.show();
    const container = this.root.querySelector(".powerup-choices") as HTMLDivElement;
    container.innerHTML = "";

    const pick = new Promise<PowerupChoice>((resolve) => {
      // Generate all possible powerup improvements
      const powerupOptions = this.generatePowerupOptions(currentStats);

      for (const option of powerupOptions) {
        const btn = document.createElement("button");
        btn.className = "powerup-choice-btn";
        btn.innerHTML = `
          <div class="powerup-header">
            <span class="powerup-name">${option.family}</span>
            <span class="powerup-level">Lv ${option.currentLevel} → ${option.currentLevel + 1}</span>
          </div>
          <div class="powerup-desc">${option.desc}</div>
        `;
        btn.onclick = () => resolve({
          family: option.family,
          tier: option.currentLevel + 1,
          label: option.family,
          desc: option.desc
        });
        container.appendChild(btn);
      }
    });

    const result = await pick;
    this.hide();
    return result;
  }

  private generatePowerupOptions(stats: any) {
    if (!stats) {
      // Fallback if no stats provided
      return [
        { family: "Hull" as const, currentLevel: 1, desc: "Increases maximum health" },
        { family: "Damage" as const, currentLevel: 1, desc: "Increases bullet damage" },
        { family: "Engine" as const, currentLevel: 1, desc: "Increases acceleration" },
        { family: "FireRate" as const, currentLevel: 1, desc: "Decreases firing cooldown" },
        { family: "Magnet" as const, currentLevel: 1, desc: "Increases pickup magnet radius" },
        { family: "Shield" as const, currentLevel: 1, desc: "Provides extra protection" },
      ];
    }

    // Calculate current levels based on stats
    const baseDamage = 12;
    const baseFireRate = 220;
    const baseAccel = 700;
    const baseMaxHp = 100;
    const baseMagnet = 100;

    const hullLevel = Math.max(1, Math.min(5, Math.round((stats.maxHp - baseMaxHp) / 20) + 1));
    const damageLevel = Math.max(1, Math.min(5, Math.round((stats.damage - baseDamage) / 3) + 1));
    const engineLevel = Math.max(1, Math.min(5, Math.round((stats.accel - baseAccel) / 100) + 1));
    const fireRateLevel = Math.max(1, Math.min(5, Math.round((baseFireRate - stats.fireCooldownMs) / 30) + 1));
    const magnetLevel = Math.max(1, Math.min(5, Math.round((stats.magnetRadius - baseMagnet) / 25) + 1));
    const shieldLevel = Math.max(1, Math.min(5, Math.round(stats.shield / 10) + 1));

    return [
      {
        family: "Hull" as const,
        currentLevel: hullLevel,
        desc: `+20 HP (Current: ${stats.maxHp} HP)`
      },
      {
        family: "Damage" as const,
        currentLevel: damageLevel,
        desc: `+3 damage per bullet (Current: ${stats.damage} damage)`
      },
      {
        family: "Engine" as const,
        currentLevel: engineLevel,
        desc: `+100 acceleration (Current: ${stats.accel})`
      },
      {
        family: "FireRate" as const,
        currentLevel: fireRateLevel,
        desc: `-30ms firing cooldown (Current: ${stats.fireCooldownMs}ms)`
      },
      {
        family: "Magnet" as const,
        currentLevel: magnetLevel,
        desc: `+25 pickup radius (Current: ${stats.magnetRadius})`
      },
      {
        family: "Shield" as const,
        currentLevel: shieldLevel,
        desc: `+10 shield points (Current: ${stats.shield})`
      },
    ].filter(option => option.currentLevel < 5); // Only show upgradeable powerups
  }
}

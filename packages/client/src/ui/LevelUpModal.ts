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
        { family: "Radar" as const, currentLevel: 1, desc: "Provides extra protection" },
      ];
    }

    // Base stats to calculate levels from - match server exactly
    const baseDamage = 12;
    const baseFireRate = 220;
    const baseAccel = 700;
    const baseMaxHp = 100;
    const baseMagnet = 100;

    // Safely access stats with fallbacks - use the same logic as HUD
    const maxHp = stats.maxHp || baseMaxHp;
    const damage = stats.damage || baseDamage;
    const accel = stats.accel || baseAccel;
    const fireCooldownMs = stats.fireCooldownMs || baseFireRate;
    const magnetRadius = stats.magnetRadius || baseMagnet;
    const shield = stats.shield || 0;

    // Use ACTUAL server upgrade amounts for level calculations
    const hullLevel = Math.max(1, Math.min(5, Math.round((maxHp - baseMaxHp) / 20) + 1));
    const damageLevel = Math.max(1, Math.min(5, Math.round((damage - baseDamage) / 4) + 1)); // Server uses +4
    const engineLevel = Math.max(1, Math.min(5, Math.round((accel - baseAccel) / 80) + 1)); // Server uses +80
    const fireRateLevel = Math.max(1, Math.min(5, Math.round((baseFireRate - fireCooldownMs) / 25) + 1)); // Server uses -25
    const magnetLevel = Math.max(1, Math.min(5, Math.round((magnetRadius - baseMagnet) / 30) + 1)); // Server uses +30
    const radarLevel = Math.max(1, Math.min(5, Math.round(shield / 10) + 1));

    return [
      {
        family: "Hull" as const,
        currentLevel: hullLevel,
        desc: `+20 HP (Current: ${maxHp} HP)`
      },
      {
        family: "Damage" as const,
        currentLevel: damageLevel,
        desc: `+4 damage per bullet (Current: ${damage} damage)` // Updated to match server
      },
      {
        family: "Engine" as const,
        currentLevel: engineLevel,
        desc: `+80 acceleration (Current: ${accel})` // Updated to match server
      },
      {
        family: "FireRate" as const,
        currentLevel: fireRateLevel,
        desc: `-25ms firing cooldown (Current: ${fireCooldownMs}ms)` // Updated to match server
      },
      {
        family: "Magnet" as const,
        currentLevel: magnetLevel,
        desc: `+30 pickup radius (Current: ${magnetRadius})` // Updated to match server
      },
      {
        family: "Radar" as const,
        currentLevel: radarLevel,
        desc: `+10 shield & zoom out (Current: ${shield})`
      },
    ].filter(option => option.currentLevel < 5); // Only show upgradeable powerups
  }
}

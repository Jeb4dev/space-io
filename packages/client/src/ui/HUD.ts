type Bars = { hp: HTMLDivElement; xp: HTMLDivElement };

export class HUD {
  root: HTMLDivElement;
  bars: Bars;
  board: HTMLDivElement;
  powerupsPanel: HTMLDivElement;
  velocityPanel: HTMLDivElement;

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "hud";
    document.body.appendChild(this.root);

    const hp = document.createElement("div");
    hp.className = "bar hp";
    hp.innerHTML = "<div style='width:100%'></div>";
    const xp = document.createElement("div");
    xp.className = "bar xp";
    xp.innerHTML = "<div style='width:0%'></div>";
    const barsWrap = document.createElement("div");
    barsWrap.className = "bottom-bars";
    barsWrap.append(hp, xp);
    document.body.appendChild(barsWrap);

    const board = document.createElement("div");
    board.className = "card";
    this.root.appendChild(board);

    // Create powerups panel in left bottom corner
    this.powerupsPanel = document.createElement("div");
    this.powerupsPanel.className = "powerups-panel";
    this.powerupsPanel.innerHTML = "<h3>Powerups</h3><div class='powerups-list'></div>";
    document.body.appendChild(this.powerupsPanel);

    // Create velocity panel in bottom left corner
    this.velocityPanel = document.createElement("div");
    this.velocityPanel.className = "velocity-panel";
    this.velocityPanel.innerHTML = `
      <div class="velocity-label">Speed</div>
      <div class="velocity-value">0</div>
      <div class="velocity-unit">px/s</div>
    `;
    document.body.appendChild(this.velocityPanel);

    this.bars = {
      hp: hp.firstElementChild as HTMLDivElement,
      xp: xp.firstElementChild as HTMLDivElement,
    };
    this.board = board;
  }

  setHP(hp: number, max: number) {
    const pct = Math.max(0, Math.min(1, hp / max)) * 100;
    this.bars.hp.style.width = `${pct}%`;
  }

  setXP(xp: number, toNext: number) {
    const pct = Math.max(0, Math.min(1, xp / toNext)) * 100;
    this.bars.xp.style.width = `${pct}%`;
  }

  setVelocity(vx: number, vy: number) {
    const speed = Math.hypot(vx, vy);
    const speedRounded = Math.round(speed);
    const valueElement = this.velocityPanel.querySelector('.velocity-value') as HTMLDivElement;
    if (valueElement) {
      valueElement.textContent = speedRounded.toString();

      // Add color coding based on speed
      if (speed < 50) {
        valueElement.style.color = '#4caf50'; // Green for slow
      } else if (speed < 150) {
        valueElement.style.color = '#ffeb3b'; // Yellow for medium
      } else if (speed < 250) {
        valueElement.style.color = '#ff9800'; // Orange for fast
      } else {
        valueElement.style.color = '#f44336'; // Red for very fast
      }
    }
  }

  setPowerups(stats: any) {
    const container = this.powerupsPanel.querySelector('.powerups-list') as HTMLDivElement;
    if (!container) return;

    // Calculate powerup levels based on player stats
    const powerups = this.calculatePowerupLevels(stats);

    container.innerHTML = powerups.map(p =>
      `<div class="powerup-item">
        <span class="powerup-name">${p.name}</span>
        <span class="powerup-level">Lv ${p.level}</span>
      </div>`
    ).join('');
  }

  private calculatePowerupLevels(stats: any) {
    // Use the exact same base values as the server
    const baseDamage = 12;     // BULLET.baseDamage
    const baseFireRate = 220;  // BULLET.cooldownMs
    const baseAccel = 700;     // PLAYER.baseAccel
    const baseMaxHp = 100;     // PLAYER.baseHP
    const baseMagnet = 100;    // PICKUPS.magnetBaseRadius

    // Safely access stats with fallbacks
    const maxHp = stats.maxHp || baseMaxHp;
    const damage = stats.damage || baseDamage;
    const accel = stats.accel || baseAccel;
    const fireCooldownMs = stats.fireCooldownMs || baseFireRate;
    const magnetRadius = stats.magnetRadius || baseMagnet;
    const shield = stats.shield || 0;

    // Debug logging to see what we're getting
    console.log('Player stats received:', stats);
    console.log('Calculated values:', { maxHp, damage, accel, fireCooldownMs, magnetRadius, shield });

    // Use the ACTUAL server upgrade amounts for level calculations
    return [
      { name: "Hull", level: Math.max(1, Math.min(5, Math.round((maxHp - baseMaxHp) / 20) + 1)) },
      { name: "Damage", level: Math.max(1, Math.min(5, Math.round((damage - baseDamage) / 4) + 1)) }, // Server uses +4
      { name: "Engine", level: Math.max(1, Math.min(5, Math.round((accel - baseAccel) / 80) + 1)) }, // Server uses +80
      { name: "FireRate", level: Math.max(1, Math.min(5, Math.round((baseFireRate - fireCooldownMs) / 25) + 1)) }, // Server uses -25
      { name: "Magnet", level: Math.max(1, Math.min(5, Math.round((magnetRadius - baseMagnet) / 30) + 1)) }, // Server uses +30
      { name: "Shield", level: Math.max(1, Math.min(5, Math.round(shield / 10) + 1)) },
    ];
  }

  setScoreboard(entries: Array<{ name: string; score: number; level: number }>) {
    const lines = entries
      .map((e, i) => `${i + 1}. ${e.name} — ${e.score} (Lv ${e.level})`)
      .join("<br/>");
    this.board.innerHTML = `<strong>Top 10</strong><br/>${lines || "No players"}`;
  }
}

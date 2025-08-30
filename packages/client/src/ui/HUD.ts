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

    // Prefer explicit powerupLevels from server; else derive
    const serverLevels = stats.powerupLevels as Record<string, number> | undefined;

    const families = ["Hull", "Damage", "Engine", "FireRate", "Magnet", "Shield"] as const;
    let list: { name: string; level: number; max: number }[] = [];

    if (serverLevels) {
      // Add 1 to display level since server uses 0-based but UI should show 1-based
      list = families.map(name => ({ name, level: (serverLevels[name] ?? 0) + 1, max: 5 }));
    } else {
      // Fallback to calculation (legacy)
      const calc = this.calculatePowerupLevels(stats);
      const calcMap: Record<string, number> = {};
      for (const c of calc) calcMap[c.name] = c.level;
      // Add 1 to display level since calculation gives 0-based but UI should show 1-based
      list = families.map(name => ({ name, level: (calcMap[name] ?? 0) + 1, max: 5 }));
    }

    // Build HTML (always show all families)
    container.innerHTML = list.map(p => `
      <div class="powerup-item">
        <span class="powerup-name">${p.name}</span>
        <span class="powerup-level">Lv ${p.level}/${p.max}</span>
      </div>`).join('');
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

    // Calculate actual upgrade levels (0 = no upgrades, 1-5 = upgrade levels)
    const powerups = [
      { name: "Hull", level: Math.round((maxHp - baseMaxHp) / 20) },
      { name: "Damage", level: Math.round((damage - baseDamage) / 4) },
      { name: "Engine", level: Math.round((accel - baseAccel) / 80) },
      { name: "FireRate", level: Math.round((baseFireRate - fireCooldownMs) / 25) },
      { name: "Magnet", level: Math.round((magnetRadius - baseMagnet) / 30) },
      { name: "Shield", level: Math.round(shield / 10) },
    ];

    // Only return powerups that have been upgraded (level > 0)
    return powerups.filter(p => p.level > 0).map(p => ({
      ...p,
      level: Math.min(5, p.level) // Cap at level 5
    }));
  }

  setScoreboard(entries: Array<{ name: string; score: number; level: number }>) {
    const lines = entries
      .map((e, i) => `${i + 1}. ${e.name} — ${e.score} (Lv ${e.level})`)
      .join("<br/>");
    this.board.innerHTML = `<strong>Top 10</strong><br/>${lines || "No players"}`;
  }
}

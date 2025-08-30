type Bars = { hp: HTMLDivElement; xp: HTMLDivElement };

export class HUD {
  root: HTMLDivElement;
  bars: Bars;
  board: HTMLDivElement;
  powerupsPanel: HTMLDivElement;

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
    // Base stats to calculate levels from
    const baseDamage = 12;
    const baseFireRate = 220;
    const baseAccel = 700;
    const baseMaxSpeed = 300;
    const baseMaxHp = 100;
    const baseMagnet = 100;

    return [
      { name: "Hull", level: Math.round((stats.maxHp - baseMaxHp) / 20) + 1 },
      { name: "Damage", level: Math.round((stats.damage - baseDamage) / 3) + 1 },
      { name: "Engine", level: Math.round((stats.accel - baseAccel) / 100) + 1 },
      { name: "FireRate", level: Math.round((baseFireRate - stats.fireCooldownMs) / 30) + 1 },
      { name: "Magnet", level: Math.round((stats.magnetRadius - baseMagnet) / 25) + 1 },
      { name: "Shield", level: Math.round(stats.shield / 10) + 1 },
    ].map(p => ({ ...p, level: Math.max(1, Math.min(5, p.level)) }));
  }

  setScoreboard(entries: Array<{ name: string; score: number; level: number }>) {
    const lines = entries
      .map((e, i) => `${i + 1}. ${e.name} — ${e.score} (Lv ${e.level})`)
      .join("<br/>");
    this.board.innerHTML = `<strong>Top 10</strong><br/>${lines || "No players"}`;
  }
}

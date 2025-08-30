export interface GameOverStats {
  score: number;
  level: number;
  durationMs: number;
  distance: number;
  maxSpeed: number;
  kills?: number; // placeholder if added later
}

export class GameOverModal {
  root: HTMLDivElement;
  private statsEl!: HTMLDivElement;
  private resolveFn: (() => void) | null = null;

  constructor() {
    const overlay = document.createElement('div');
    overlay.className = 'ui-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal gameover-modal';
    modal.innerHTML = `
      <h2 class="go-title">Game Over</h2>
      <div class="go-sub">Your run has ended.</div>
      <div class="go-stats"></div>
      <div class="go-actions">
        <button class="btn primary go-respawn">Respawn ▶</button>
      </div>
      <div class="go-hint">Tip: Upgrades stack – survive longer to snowball harder.</div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.root = overlay;
    this.statsEl = modal.querySelector('.go-stats') as HTMLDivElement;
    this.hide();

    const respawnBtn = modal.querySelector('.go-respawn') as HTMLButtonElement;
    respawnBtn.onclick = () => this.finish();
  }

  private finish() {
    if (!this.resolveFn) return;
    const r = this.resolveFn;
    this.resolveFn = null;
    this.hide();
    document.body.classList.remove('game-over');
    r();
  }

  show(stats: GameOverStats) {
    const mins = Math.floor(stats.durationMs / 60000);
    const secs = Math.floor((stats.durationMs % 60000) / 1000);
    const timeStr = `${mins}m ${secs}s`;
    const distStr = `${Math.round(stats.distance)} px`;
    const maxSpeedStr = `${Math.round(stats.maxSpeed)} px/s`;
    const scoreStr = stats.score.toLocaleString();

    this.statsEl.innerHTML = `
      <ul class="go-stat-list">
        <li><span>Score</span><strong>${scoreStr}</strong></li>
        <li><span>Level Reached</span><strong>${stats.level}</strong></li>
        <li><span>Survival Time</span><strong>${timeStr}</strong></li>
        <li><span>Distance Traveled</span><strong>${distStr}</strong></li>
        <li><span>Max Speed</span><strong>${maxSpeedStr}</strong></li>
      </ul>
    `;
    document.body.classList.add('game-over');
    this.root.style.display = 'flex';
  }

  async waitRespawn(): Promise<void> {
    return new Promise(res => { this.resolveFn = res; });
  }

  hide() { this.root.style.display = 'none'; }
}


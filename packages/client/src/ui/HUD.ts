type Bars = { hp: HTMLDivElement; xp: HTMLDivElement };
export class HUD {
  root: HTMLDivElement;
  bars: Bars;
  board: HTMLDivElement;

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

  setScoreboard(entries: Array<{ name: string; score: number; level: number }>) {
    const lines = entries
      .map((e, i) => `${i + 1}. ${e.name} — ${e.score} (Lv ${e.level})`)
      .join("<br/>");
    this.board.innerHTML = `<strong>Top 10</strong><br/>${lines || "No players"}`;
  }
}

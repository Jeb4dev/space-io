import type { PowerupChoice } from "@shared/types";

export class LevelUpModal {
  root: HTMLDivElement;

  constructor() {
    const overlay = document.createElement("div");
    overlay.className = "ui-overlay";
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `<h2>Level Up!</h2><div class="choices"></div>`;
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

  async choose(choices: PowerupChoice[]): Promise<PowerupChoice> {
    this.show();
    const container = this.root.querySelector(".choices") as HTMLDivElement;
    container.innerHTML = "";
    const pick = new Promise<PowerupChoice>((resolve) => {
      for (const c of choices) {
        const btn = document.createElement("button");
        btn.textContent = `${c.label} — ${c.desc}`;
        btn.onclick = () => resolve(c);
        container.appendChild(btn);
      }
    });
    const result = await pick;
    this.hide();
    return result;
  }
}

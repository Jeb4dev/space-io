export class NamePrompt {
  root: HTMLDivElement;
  constructor() {
    const overlay = document.createElement("div");
    overlay.className = "ui-overlay";
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <h2>Enter a name</h2>
      <input id="nm" maxlength="24" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2b3452;background:#0e1422;color:#e6ecff" placeholder="Anonymous" />
      <div style="height:8px"></div>
      <button id="go">Play</button>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.root = overlay;
  }

  async getName(): Promise<string> {
    this.root.style.display = "flex";
    const nm = this.root.querySelector("#nm") as HTMLInputElement;
    const btn = this.root.querySelector("#go") as HTMLButtonElement;
    nm.focus();
    return new Promise((res) => {
      let done = false;
      const ok = () => { if (done) return; done = true; this.root.remove(); res(nm.value || "Anon"); };
      btn.onclick = ok;
      nm.onkeydown = (e) => { if (e.key === "Enter") ok(); };
    });
  }
}


import type { EntityState } from "@game/shared";

export class Interp {
  previous = new Map<string, EntityState>();
  current = new Map<string, EntityState>();
  alpha = 0;

  push(entities: EntityState[]) {
    this.previous = this.current;
    this.current = new Map(entities.map((e) => [e.id, e]));
    this.alpha = 0;
  }

  step(dt: number, snapshotIntervalMs: number) {
    this.alpha = Math.min(1, this.alpha + (dt * 1000) / snapshotIntervalMs);
  }

  get(id: string): EntityState | undefined {
    const prev = this.previous.get(id);
    const curr = this.current.get(id);
    if (!prev || !curr) return curr ?? prev;
    const a = this.alpha;
    return {
      ...curr,
      x: prev.x + (curr.x - prev.x) * a,
      y: prev.y + (curr.y - prev.y) * a,
    };
  }

  ids(): string[] {
    return Array.from(this.current.keys());
  }
}

import type { ClientInput, EntityState } from "@shared/messages";

export class Recon {
  seq = 0;
  unacked: ClientInput[] = [];
  you!: EntityState;

  record(input: ClientInput) {
    this.unacked.push(input);
    this.seq = input.seq;
  }

  setYouState(state: EntityState) {
    this.you = { ...state };
  }

  reconcile(serverYou: EntityState) {
    // snap to server then replay
    this.you = { ...serverYou };
    // Inputs already acked on server are accounted by ack seq; trim guessed list
    this.unacked = this.unacked.filter((i) => i.seq > (window as any).net.lastAckSeq);
    for (const i of this.unacked) {
      this.you.x += i.thrust.x * 0.02 * 30; // approximate
      this.you.y += i.thrust.y * 0.02 * 30;
    }
  }
}


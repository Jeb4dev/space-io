# Space-IO — High-Level Design

Authoritative Node/TS server (Socket.IO) at 30 Hz simulates a bounded arena with gravity wells
(planet/sun/black hole). Entities are circles with simple physics. Client is Phaser 3 + TS with
Matter used only for visual colliders/overlaps (server is source of truth).

**Networking**
- Client sends input frames `{seq, thrust(x,y), aim, fire, dtMs}` at 30–60 Hz.
- Server emits snapshots at ~12 Hz with entity states, pickups, wells and scoreboard.
- Client predicts local ship and reconciles on snapshots; interpolates others.

**Progression**
- XP from pickups and kills. Level thresholds: `base * level^1.4`.
- On level-up, server offers 3 random powerups (weighted by what player lacks).
- At level 10, an alt-fire choice is offered: Railgun (pierce, long cd) or Spread (cone).

**Death/Respawn**
- On kill, drop XP orbs, respawn at edge away from nearest player, 2 s invuln.

**Interest Management**
- Initial MVP broadcasts all; config supports sending within radius (2–3 screens).

**Bots**
- Simple seek/flee/pickups/fire state machine; off by default.


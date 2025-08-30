## You are a senior game engineer.

Create a **jam‑ready, maintainable monorepo** for a browser .io game called **Space‑IO**. The game is a **multiplayer top‑down space arena** where players fly a ship, collect space junk/star dust, level up, pick powerups, and fight. Gravity wells (planets/suns/black holes) pull ships; hazards can kill. When a player dies, they respawn at the edge. Target **\~16 players per room**. **Mobile‑first** UI.

### Tech choices (firm):

- **Monorepo**: pnpm workspaces.
- **Client**: Phaser 3 + **TypeScript** + Vite. Use **Matter** physics on the client for visuals/colliders.
- **Server**: Node.js + **TypeScript**, **Socket.IO** for networking. **Authoritative** server with a fixed tick (30Hz). Implement **simplified circle physics** + gravity (no Matter on the server to keep CPU low).
- **Shared**: a small package with shared **zod** schemas, enums, constants, and math helpers.
- **Lint/Format**: ESLint + Prettier.
- **Env**: dotenv. Config via `packages/server/src/config.ts`.
- **Docker**: Dockerfile for server and a simple Nginx (or Vite preview) for client; docker‑compose for local.

### Core gameplay (MVP):

- **Camera**: Player ship fixed center; parallax starfield background that scrolls.
- **Controls**: mouse/touch aim; thrust towards pointer; hold/click to fire.
- **Pickups**: space junk & star dust give XP; some HP orbs rare.
- **Leveling**: XP curve; on level up, present **3 random powerup choices**; **6 powerup families**, each with **5 tiers** (stacking). Modular design so new powerups drop in.
- **Alt‑fire**: locked until **Level 10**, then offer an **alt‑fire powerup** (choose one of: _Railgun_ or _Spread_).
- **Combat**: primary blaster; projectiles simulated on server; client predicts and reconciles.
- **Gravity wells**: planets/suns/black holes exert pull `F = G * m / (d^2 + ε)`, with **influence radius** and **max pull cap**. Close to suns = heat damage; black holes = strong pull + edge damage; planets = pull + hard collision.
- **Arena**: bounded world (configurable); out‑of‑bounds clamps. Player sees a small portion; add parallax for motion feel.
- **Scoreboard**: Top 10 by score/XP, shown in HUD top‑right, with names.
- **Respawn**: instant at edge, 2s invulnerability (shader/outline or alpha).
- **Names**: On first load, prompt for name; **anonymous allowed**. Apply a simple **profanity filter**.
- **Bots**: Lightweight bots (simple seek/flee/pickups) if fewer than N players; off by default via config.

### Networking (authoritative but jam‑friendly):

- Client → server: input frames `{seq, thrust:[x,y], aim:number, fire:boolean, dtMs}` @ 30–60Hz (coalesce if needed).
- Server → client: **snapshots** @ 10–15Hz (positions, velocities, HP, nearby pickups/entities) + **event messages** (kills, pickups, level up offers) + scoreboard diffs.
- **Prediction & reconciliation**: client stores inputs until ack; upon snapshot, rewinds/ reapplies unacked inputs.
- **Interest management**: send full detail for entities within 2–3 screen radii; skip distant entities.

### Powerups (initial set):

1. **Hull** (+Max HP per tier)
2. **Blaster Damage** (+dmg per tier)
3. **Engine** (+max speed/accel per tier)
4. **Fire Rate** (+rate, reduces cooldown)
5. **Magnet** (+pickup vacuum radius)
6. **Shield** (+charges or regen per tier)

**Alt‑fire at Level 10 (choose 1):**

- **Railgun** (high dmg, pierce, long cooldown)
- **Spread** (shotgun cone, lower range)

### Deliverables / Repo layout

```
game/
├─ package.json               # workspaces + scripts
├─ pnpm-workspace.yaml
├─ turbo.json                 # optional: pipeline cache (ok to include)
├─ .editorconfig
├─ .eslintrc.cjs
├─ .prettierrc
├─ docker-compose.yml
├─ docs/
│  ├─ DESIGN.md
│  ├─ POWERUPS.md
│  └─ CONTRIBUTING.md
├─ packages/
│  ├─ shared/
│  │  ├─ src/{constants.ts, types.ts, messages.ts, math.ts, index.ts}
│  │  └─ package.json
│  ├─ server/
│  │  ├─ src/
│  │  │  ├─ index.ts              # entry; starts HTTP+Socket.IO
│  │  │  ├─ config.ts
│  │  │  ├─ net/
│  │  │  │  ├─ socket.ts          # connection, rooms, acks
│  │  │  ├─ sim/
│  │  │  │  ├─ loop.ts            # fixed tick, timeline
│  │  │  │  ├─ world.ts           # arena, gravity wells, spawns
│  │  │  │  ├─ entities.ts        # players, bots, bullets, pickups
│  │  │  │  ├─ systems/
│  │  │  │  │  ├─ physics.ts      # simple circle physics + gravity
│  │  │  │  │  ├─ combat.ts       # damage, death, respawn
│  │  │  │  │  ├─ pickups.ts      # spawn/collect, XP
│  │  │  │  │  ├─ powerups.ts     # leveling, offers, effects
│  │  │  │  │  └─ scoreboard.ts
│  │  │  └─ util/
│  │  │     ├─ rng.ts             # seedable RNG if needed
│  │  │     └─ nameFilter.ts
│  │  ├─ package.json
│  │  ├─ Dockerfile
│  │  └─ tsconfig.json
│  └─ client/
│     ├─ index.html
│     ├─ src/
│     │  ├─ main.ts
│     │  ├─ scenes/GameScene.ts
│     │  ├─ net/socket.ts
│     │  ├─ state/{recon.ts, interp.ts}
│     │  ├─ ui/{HUD.ts, LevelUpModal.ts, NamePrompt.ts}
│     │  ├─ gameplay/{Ship.ts, Projectiles.ts, Pickups.ts, Parallax.ts}
│     │  ├─ assets/placeholder/  # temp PNGs; real art later
│     │  └─ styles.css
│     ├─ vite.config.ts
│     ├─ package.json
│     └─ tsconfig.json
```

### Implementation notes

- **Server physics**: entities are circles with `pos, vel, radius, mass, hp`. Gravity wells are static points with `mass, radius, maxPull, influenceRadius`.
- **Tick**: semi‑implicit Euler. Clamp max speed. Soft‑cap gravity near core to avoid tunneling.
- **Collisions**: circle vs circle (players, bullets, planets as big circles). Apply bounce or damage for planets; kill near black hole horizon.
- **Leveling**: compute XP threshold via `base * level^1.4`. On level up, server rolls 3 choices (weighted by what player lacks), sends `LevelUpOffer`; client shows modal; client responds `LevelUpChoice`.
- **Scoreboard**: top 10 maintained server‑side; emit diffs only when changed.
- **Bots**: simple state machine: wander → seek pickups → flee strong gravity → fire at nearest target in range.
- **Mobile**: use Phaser Scale.FIT; large UI targets; pointer lock not required. Provide on‑screen fire button for touch (bottom‑right), and a simple thrust stick or "tap to thrust toward pointer" behavior.

### Required packages

- shared: `zod`
- server: `express`, `socket.io`, `cors`, `dotenv`, `zod`, `nanoid`
- client: `phaser`, `socket.io-client`
- dev: `typescript`, `ts-node`, `vite`, `eslint`, `prettier`
- optional profanity: `bad-words` (or a tiny filtered list)

### Message schemas (zod) — implement in `packages/shared/src/messages.ts`

- `ClientInput` `{ id: string, seq: number, aim: number, thrust: {x:number,y:number}, fire: boolean, dtMs: number }`
- `ClientJoin` `{ name: string }`
- `ServerWelcome` `{ youId: string, tickRate: number, snapshotRate: number, world: {w:number,h:number} }`
- `ServerSnapshot` `{ tick: number, youId: string, acks: {seq:number}, entities: EntityState[], pickups: PickupState[], wells: WellState[], scoreboard: ScoreEntry[] }`
- `ServerEvent` union: `Kill`, `Pickup`, `LevelUpOffer { choices: PowerupChoice[] }`, `LevelUpApplied { updated: PlayerStats }`
- Keep **types/enums/constants** in `packages/shared/src/{types,constants}.ts` (powerups, alt‑fire types, entity kinds, limits).

### Minimal server loop (spec)

- fixed tick @ 30Hz (`setInterval` or `setTimeout` drift‑corrected).
- integrate velocities with gravity; resolve collisions; process inputs by `seq` in order.
- spawn pickups periodically; keep target counts.
- handle fire cooldown; spawn bullets (server‑side).
- on death: emit `Kill` event, drop some XP orbs, respawn after 0.5s at edge away from nearest player.
- broadcast snapshots @ 12Hz (interpolate client‑side).

### Client MVP (spec)

- **GameScene** boots, connects socket, shows `NamePrompt` modal → sends `ClientJoin`.
- On `ServerWelcome`, start prediction; create your Ship entity; create placeholder sprites for others; set camera follow (centered).
- Render parallax starfield (two layers) scrolling by velocity.
- HUD: top‑right scoreboard; bottom center HP bar; bottom left XP bar/level; bottom overlay for level‑up choices (3 buttons, pause input while open).
- Touch: simple UI buttons for fire; tapping/dragging the playfield sets aim & thrust.
- Interp other ships with linear interpolation; own ship uses prediction + reconciliation.

### Config & scripts

- Root `package.json` with workspaces + scripts: `dev` (run client+server concurrently), `build`, `start` (server)
- Provide `.env.example` for server (`PORT`, `PUBLIC_URL`, `SNAPSHOT_HZ`, `TICK_HZ`, `ROOM_CAP`, `BOTS_ENABLED`).
- Docker: multi‑stage server build; compose file to run server + client (served by Nginx or `vite preview`).

### Quality gates

- TypeScript strict mode on everywhere.
- ESLint + Prettier configured and passing.
- Running `pnpm dev` should: start server on `localhost:8080` and client on `localhost:15173`, with CORS allowed.
- 1 room, up to 16 players.
- Ship, pickups, gravity wells, bullets, damage, death/respawn, level‑up choices (functional, even with placeholder art).

### Non‑goals (for the MVP):

- persistence, accounts, matchmaking, cosmetics store.

### Output format

Return **one markdown document** that:

1. Shows the **repo tree**, and
2. For each file, provides a code block with its content.

Where files are long, include complete, runnable versions (don’t omit key logic).

Include **first‑run instructions** at the end with exact commands to install (`pnpm i`) and start (`pnpm dev`), and a quick troubleshooting section.

---

## Acceptance checklist (the code must satisfy):

- [ ] Monorepo builds and runs: `pnpm i && pnpm dev` boots both apps.
- [ ] Client connects, prompts for name, spawns ship, can thrust & fire on desktop and mobile.
- [ ] Pickups increment XP; at level‑up a modal with **3 choices** appears; picking applies and closes modal.
- [ ] Server simulates gravity wells and bullets; snapshots move other players smoothly.
- [ ] Scoreboard (top‑right) shows top 10 with live updates.
- [ ] Death → respawn with brief invulnerability.
- [ ] Arena size, gravity strengths, and powerups are configured in `shared/constants.ts`.
- [ ] ESLint + Prettier pass; TypeScript strict across all packages.
- [ ] Docker builds for server; compose up serves both.

> If any constraint conflicts, prefer **simplicity and reliability** so the jam team can iterate quickly.

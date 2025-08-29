import type { World } from "../world.js";
import { collectPickups, spawnPickupsIfNeeded } from "../entities.js";

export const updatePickups = (world: World) => {
  spawnPickupsIfNeeded(world);
  collectPickups(world);
};

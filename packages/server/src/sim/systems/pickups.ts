import type { World } from "../world";
import { collectPickups, spawnPickupsIfNeeded } from "../entities";

export const updatePickups = (world: World) => {
  spawnPickupsIfNeeded(world);
  collectPickups(world);
};


import { GRAVITY, WORLD } from "@shared/constants.js";
import { rndRange } from "@shared/math.js";
import type { World } from "../world.js";

// Pool of planet configurations for variety - updated with balanced gravity values
const PLANET_CONFIGS = [
  { mass: 2e6, radius: 120, influenceRadius: 600, type: "planet" as const, maxPull: 400, texture: "EARTH" },
  { mass: 2.5e6, radius: 110, influenceRadius: 500, type: "planet" as const, maxPull: 350, texture: "MARS" },
  { mass: 3e6, radius: 140, influenceRadius: 650, type: "planet" as const, maxPull: 450, texture: "JUPITER" },
  { mass: 1.8e6, radius: 100, influenceRadius: 480, type: "planet" as const, maxPull: 300, texture: "VENUS" },
  { mass: 4e6, radius: 180, influenceRadius: 800, type: "sun" as const, maxPull: 600, texture: "SATURNUS" },
];

let nextPlanetId = 1000; // Start high to avoid conflicts with static wells

export const updatePlanetMovement = (world: World, dt: number): void => {
  const scrollSpeed = GRAVITY.planetScrollSpeed;

  for (const well of world.wells) {
    // Only move planets and suns, keep black holes stationary
    if (well.type === "planet" || well.type === "sun") {
      // Move planet downward
      well.y += scrollSpeed * dt;

      // Check if planet has moved beyond the bottom of the world
      const exitThreshold = WORLD.h + well.influenceRadius;
      if (well.y > exitThreshold) {
        // Respawn at the top with new random properties
        respawnPlanet(well);
      }
    }
  }
};

const respawnPlanet = (well: any): void => {
  // Choose a random planet configuration
  const config = PLANET_CONFIGS[Math.floor(Math.random() * PLANET_CONFIGS.length)];

  // Apply new configuration
  well.mass = config.mass;
  well.radius = config.radius;
  well.influenceRadius = config.influenceRadius;
  well.type = config.type;
  well.maxPull = config.maxPull;
  well.texture = config.texture;

  // Position at top with random horizontal position
  well.y = -well.influenceRadius - rndRange(0, 500); // Stagger spawn times
  well.x = rndRange(well.influenceRadius, WORLD.w - well.influenceRadius);

  // Give it a new unique ID
  well.id = `planet_${nextPlanetId++}`;
};

import { createNoise2D } from "simplex-noise";

const noise2D = createNoise2D();

/** Same base field as the original meadow, with low hills only past the sword. */
export function terrainHeight(x: number, z: number) {
  let y = 2 * noise2D(x / 50, z / 50);
  y += 4 * noise2D(x / 100, z / 1000);
  y += 0.2 * noise2D(x / 10, z / 10);
  const dist = Math.hypot(x, z);
  const far = dist <= 40 ? 0 : dist >= 95 ? 1 : (dist - 40) / 55;
  const smooth = far * far * (3 - 2 * far);
  y += smooth * 7.5 * noise2D(x / 230, z / 230);
  return y;
}

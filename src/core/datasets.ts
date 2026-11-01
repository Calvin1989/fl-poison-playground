import type { Rng } from "./random";
import type { Localized } from "./text";

/** One labeled point. Coordinates live in [-1, 1]. */
export interface Sample {
  x: number;
  y: number;
  label: number;
}

export interface Dataset {
  id: string;
  name: Localized;
  classes: number;
  /** Draw one point of the given class. */
  sample(rng: Rng, label: number): Sample;
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const point = (x: number, y: number, label: number): Sample => ({ x: clamp(x), y: clamp(y), label });

const blobs: Dataset = {
  id: "blobs",
  name: { en: "Blobs", zh: "团簇" },
  classes: 3,
  sample(rng, label) {
    const angle = Math.PI / 2 + (label * 2 * Math.PI) / 3;
    return point(0.5 * Math.cos(angle) + 0.17 * rng.normal(), 0.5 * Math.sin(angle) + 0.17 * rng.normal(), label);
  },
};

const moons: Dataset = {
  id: "moons",
  name: { en: "Moons", zh: "双月" },
  classes: 2,
  sample(rng, label) {
    const t = Math.PI * rng.next();
    const [x, y] = label === 0 ? [Math.cos(t), Math.sin(t)] : [1 - Math.cos(t), 0.5 - Math.sin(t)];
    return point((x - 0.5) / 1.6 + 0.07 * rng.normal(), (y - 0.25) / 1.4 + 0.07 * rng.normal(), label);
  },
};

const circles: Dataset = {
  id: "circles",
  name: { en: "Circles", zh: "同心圆" },
  classes: 2,
  sample(rng, label) {
    const angle = 2 * Math.PI * rng.next();
    const radius = label === 0 ? 0.35 * Math.sqrt(rng.next()) : 0.6 + 0.3 * rng.next();
    return point(radius * Math.cos(angle), radius * Math.sin(angle), label);
  },
};

const xor: Dataset = {
  id: "xor",
  name: { en: "XOR", zh: "异或" },
  classes: 2,
  sample(rng, label) {
    const coord = () => (rng.next() < 0.5 ? -1 : 1) * (0.06 + 0.88 * rng.next());
    const x = coord();
    let y = coord();
    if ((x * y > 0 ? 0 : 1) !== label) y = -y;
    return point(x, y, label);
  },
};

export const DATASETS: readonly Dataset[] = [blobs, moons, circles, xor];

export function getDataset(id: string): Dataset {
  return DATASETS.find((d) => d.id === id) ?? DATASETS[0];
}

/** Same number of points for every class. */
export function balancedSet(rng: Rng, dataset: Dataset, perClass: number): Sample[] {
  const out: Sample[] = [];
  for (let label = 0; label < dataset.classes; label++) {
    for (let i = 0; i < perClass; i++) out.push(dataset.sample(rng, label));
  }
  return out;
}

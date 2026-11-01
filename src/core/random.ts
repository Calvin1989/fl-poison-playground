/**
 * Seeded random numbers, so every run with the same settings is reproducible.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Standard normal. */
  normal(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
}

/** mulberry32: small, fast, good enough for simulation. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  let spare: number | null = null;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const normal = () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    // Box-Muller
    let u = 0;
    while (u === 0) u = next();
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };

  return { next, normal, int: (n) => Math.floor(next() * n) };
}

/** Derive an independent stream, so changing one part of a run does not reshuffle the others. */
export function deriveSeed(seed: number, stream: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < stream.length; i++) {
    h = Math.imul(h ^ stream.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h;
}

/** Gamma(shape, 1) via Marsaglia-Tsang. */
function gamma(rng: Rng, shape: number): number {
  if (shape < 1) {
    // Boost small shapes, then correct.
    return gamma(rng, shape + 1) * Math.pow(rng.next() || Number.MIN_VALUE, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = rng.normal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng.next();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Symmetric Dirichlet(alpha) sample of length k. */
export function dirichlet(rng: Rng, alpha: number, k: number): number[] {
  const draws = Array.from({ length: k }, () => gamma(rng, alpha));
  const total = draws.reduce((a, b) => a + b, 0);
  return total > 0 ? draws.map((g) => g / total) : draws.map(() => 1 / k);
}

/** Index drawn from a discrete distribution. */
export function pick(rng: Rng, probabilities: readonly number[]): number {
  let u = rng.next();
  for (let i = 0; i < probabilities.length; i++) {
    u -= probabilities[i];
    if (u < 0) return i;
  }
  return probabilities.length - 1;
}

/** Fisher-Yates, in place. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

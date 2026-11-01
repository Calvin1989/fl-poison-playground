/** A model update or parameter vector. */
export type Vec = Float64Array;

export function sub(a: Vec, b: Vec): Vec {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

export function scale(a: Vec, s: number): Vec {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * s;
  return out;
}

/** a += b * s, in place. */
export function addScaled(a: Vec, b: Vec, s: number): void {
  for (let i = 0; i < a.length; i++) a[i] += b[i] * s;
}

export function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function norm(a: Vec): number {
  return Math.sqrt(dot(a, a));
}

export function distSq(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

/** Sum of vecs[i] * weights[i]. */
export function weightedSum(vecs: readonly Vec[], weights: readonly number[]): Vec {
  const out = new Float64Array(vecs[0].length);
  vecs.forEach((v, i) => {
    if (weights[i] !== 0) addScaled(out, v, weights[i]);
  });
  return out;
}

export function mean(vecs: readonly Vec[]): Vec {
  return weightedSum(vecs, vecs.map(() => 1 / vecs.length));
}

/** Coordinate-wise standard deviation. */
export function std(vecs: readonly Vec[], center: Vec = mean(vecs)): Vec {
  const out = new Float64Array(center.length);
  for (const v of vecs) {
    for (let i = 0; i < v.length; i++) {
      const d = v[i] - center[i];
      out[i] += d * d;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(out[i] / vecs.length);
  return out;
}

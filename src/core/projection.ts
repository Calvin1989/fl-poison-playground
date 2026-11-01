import { dot, norm, sub, type Vec } from "./vector";

export interface Point2 {
  x: number;
  y: number;
}

/**
 * Projects high-dimensional updates onto a plane centred on a reference point
 * (the honest mean):
 *
 * - x: the direction the server's update moved away from the reference, so the
 *   distance from the reference to the server's update is drawn exactly;
 * - y: the main remaining direction in which the reference group (the honest
 *   clients) differ, found by PCA.
 *
 * The y axis carries over between rounds so the picture does not flip.
 */
export class Projector {
  private previousY: Vec | null = null;

  project(points: readonly Vec[], origin: Vec, towards: Vec, spreadOf: readonly number[]): Point2[] {
    const centred = points.map((p) => sub(p, origin));
    const group = spreadOf.map((i) => centred[i]);
    const offset = sub(towards, origin);
    const length = norm(offset);

    const xAxis = length > 1e-12 ? offset.map((v) => v / length) : principal(group, null, []);
    const yAxis = principal(group, this.previousY, [xAxis]);
    this.previousY = yAxis;
    return centred.map((p) => ({ x: dot(p, xAxis), y: dot(p, yAxis) }));
  }
}

/** Power iteration for the leading direction of `points`, orthogonal to `exclude`. */
function principal(points: readonly Vec[], previous: Vec | null, exclude: readonly Vec[]): Vec {
  const d = points[0].length;
  let v: Vec = previous && previous.length === d ? new Float64Array(previous) : seedVector(d);
  for (let iter = 0; iter < 40; iter++) {
    const next = new Float64Array(d);
    for (const p of points) {
      const c = dot(p, v);
      for (let i = 0; i < d; i++) next[i] += c * p[i];
    }
    for (const e of exclude) {
      const c = dot(next, e);
      for (let i = 0; i < d; i++) next[i] -= c * e[i];
    }
    const length = norm(next);
    if (length < 1e-12) break;
    v = next.map((x) => x / length);
  }
  // Keep the sign consistent with last round.
  if (previous && previous.length === d && dot(v, previous) < 0) v = v.map((x) => -x);
  return v;
}

function seedVector(d: number): Vec {
  const v = new Float64Array(d);
  for (let i = 0; i < d; i++) v[i] = Math.sin(1 + i * 12.9898);
  const length = norm(v);
  return v.map((x) => x / length);
}

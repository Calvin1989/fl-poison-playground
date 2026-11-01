import type { Knob } from "./knob";
import { shuffle, type Rng } from "./random";
import type { Localized } from "./text";
import { addScaled, distSq, dot, mean, norm, sub, weightedSum, type Vec } from "./vector";

export interface AggregatorContext {
  /** How many malicious clients the server assumes there are. */
  f: number;
  /** Value of the aggregator's own knob, if it has one. */
  param: number;
  rng: Rng;
  /** What the server applied last round (zeros in round one), for rules that keep history. */
  previous: Vec;
  /**
   * The server's own update, trained on a small clean, class-balanced dataset it holds
   * (the "root dataset" of FLTrust). Computed only when a rule asks for it.
   */
  rootUpdate: () => Vec;
}

export interface Aggregation {
  update: Vec;
  /** Each client's share of the aggregated update. Sums to 1, or to 0 when the rule accepted no one. */
  influence: number[];
}

/**
 * A server-side rule that turns client updates into one global update.
 * To add a defense, add one entry to AGGREGATORS; the controls pick it up automatically.
 */
export interface Aggregator {
  id: string;
  name: Localized;
  /** One plain sentence shown under the picker. */
  description: Localized;
  param?: Knob;
  aggregate(updates: readonly Vec[], context: AggregatorContext): Aggregation;
}

function average(updates: readonly Vec[]): Aggregation {
  return { update: mean(updates), influence: updates.map(() => 1 / updates.length) };
}

/** Keep, per coordinate, the values ranked `trim` .. n-1-trim and average them. trim = floor((n-1)/2) gives the median. */
function coordinateTrimmed(updates: readonly Vec[], trim: number): Aggregation {
  const n = updates.length;
  const d = updates[0].length;
  const keepFrom = Math.min(trim, Math.floor((n - 1) / 2));
  const keepTo = n - 1 - keepFrom;
  const share = 1 / (keepTo - keepFrom + 1);
  const update = new Float64Array(d);
  const influence = new Array<number>(n).fill(0);
  const order = updates.map((_, i) => i);

  for (let j = 0; j < d; j++) {
    order.sort((a, b) => updates[a][j] - updates[b][j]);
    for (let r = keepFrom; r <= keepTo; r++) {
      update[j] += updates[order[r]][j] * share;
      influence[order[r]] += share / d;
    }
  }
  return { update, influence };
}

/** Krum score: sum of squared distances to the n - f - 2 closest other updates. */
function krumScores(updates: readonly Vec[], f: number): number[] {
  const n = updates.length;
  const neighbours = Math.max(1, n - f - 2);
  const dist = updates.map((a) => updates.map((b) => distSq(a, b)));
  return dist.map((row, i) =>
    row
      .filter((_, j) => j !== i)
      .sort((a, b) => a - b)
      .slice(0, neighbours)
      .reduce((s, v) => s + v, 0),
  );
}

/** Average the `count` updates with the lowest Krum scores. */
function krumSelect(updates: readonly Vec[], f: number, count: number): Aggregation {
  const scores = krumScores(updates, f);
  const chosen = scores
    .map((score, i) => ({ score, i }))
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.max(1, count))
    .map((c) => c.i);
  const influence = updates.map((_, i) => (chosen.includes(i) ? 1 / chosen.length : 0));
  return { update: weightedSum(updates, influence), influence };
}

/**
 * Centered clipping: start from last round's update and move toward the clients,
 * but clip each client's pull to a radius, so no one can drag the result far.
 * The radius is `scale` times the median distance of clients from the start point.
 */
function centeredClip(updates: readonly Vec[], start: Vec, scale: number, iterations = 3): Aggregation {
  let center = new Float64Array(start);
  const distances = updates.map((u) => Math.sqrt(distSq(u, center)));
  const radius = scale * [...distances].sort((a, b) => a - b)[Math.floor(distances.length / 2)];
  let weights = updates.map(() => 1);

  for (let it = 0; it < iterations; it++) {
    const next = new Float64Array(center);
    weights = updates.map((u) => {
      const offset = sub(u, center);
      const w = Math.min(1, radius / (norm(offset) || 1));
      addScaled(next, offset, w / updates.length);
      return w;
    });
    center = next;
  }
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return { update: center, influence: weights.map((w) => w / total) };
}

/**
 * FLTrust: score each client by how well its direction agrees with the server's own
 * update (negative agreement scores zero), rescale every update to the server's
 * length, and take the score-weighted average.
 */
function trustBootstrap(updates: readonly Vec[], root: Vec): Aggregation {
  const rootNorm = norm(root);
  const scores = updates.map((u) => Math.max(0, dot(u, root) / ((norm(u) || 1) * (rootNorm || 1))));
  const total = scores.reduce((a, b) => a + b, 0);
  if (total === 0) return { update: new Float64Array(root.length), influence: updates.map(() => 0) };
  const influence = scores.map((s) => s / total);
  const update = weightedSum(
    updates,
    influence.map((w, i) => (w * rootNorm) / (norm(updates[i]) || 1)),
  );
  return { update, influence };
}

export const AGGREGATORS: readonly Aggregator[] = [
  {
    id: "fedavg",
    name: { en: "FedAvg" },
    description: { en: "Average all updates. No defense at all.", zh: "直接平均所有更新，没有任何防御。" },
    aggregate: (updates) => average(updates),
  },
  {
    id: "median",
    name: { en: "Median", zh: "中位数 (Median)" },
    description: { en: "Take the median of every coordinate.", zh: "对每个坐标取中位数。" },
    aggregate: (updates) => coordinateTrimmed(updates, updates.length),
  },
  {
    id: "trimmed-mean",
    name: { en: "Trimmed mean", zh: "截尾均值 (Trimmed mean)" },
    description: {
      en: "For every coordinate, drop the f largest and f smallest values, then average.",
      zh: "对每个坐标去掉最大的 f 个和最小的 f 个值，再取平均。",
    },
    aggregate: (updates, { f }) => coordinateTrimmed(updates, f),
  },
  {
    id: "krum",
    name: { en: "Krum" },
    description: {
      en: "Pick the single update that sits closest to its neighbours.",
      zh: "只选一个更新：离它最近的那些邻居距离最小的那个。",
    },
    aggregate: (updates, { f }) => krumSelect(updates, f, 1),
  },
  {
    id: "multi-krum",
    name: { en: "Multi-Krum" },
    description: {
      en: "Average the n − f updates that sit closest to their neighbours.",
      zh: "选出离邻居最近的 n − f 个更新，再取平均。",
    },
    aggregate: (updates, { f }) => krumSelect(updates, f, updates.length - f),
  },
  {
    id: "bucketing",
    name: { en: "Bucketing + Median", zh: "分桶 + 中位数 (Bucketing)" },
    description: {
      en: "Shuffle clients into small buckets, average inside each bucket, then take the median across buckets. Built for Non-IID data.",
      zh: "把客户端随机分进小桶，桶内先平均，再对各桶取中位数。专为 Non-IID 数据设计。",
    },
    param: { label: { en: "Bucket size", zh: "每桶客户端数" }, min: 2, max: 6, step: 1, default: 2 },
    aggregate: (updates, { param, rng }) => {
      const order = shuffle(rng, updates.map((_, i) => i));
      const buckets: number[][] = [];
      for (let i = 0; i < order.length; i += param) buckets.push(order.slice(i, i + param));
      const inner = coordinateTrimmed(
        buckets.map((b) => mean(b.map((i) => updates[i]))),
        buckets.length,
      );
      const influence = new Array<number>(updates.length).fill(0);
      buckets.forEach((bucket, b) => bucket.forEach((i) => (influence[i] = inner.influence[b] / bucket.length)));
      return { update: inner.update, influence };
    },
  },
  {
    id: "centered-clipping",
    name: { en: "Centered clipping", zh: "中心裁剪 (Centered clipping)" },
    description: {
      en: "Start from last round's update and move toward the clients, but cap how far any one client can pull.",
      zh: "从上一轮的更新出发向各客户端靠拢，但限制每个客户端能拉动的距离。",
    },
    param: {
      label: { en: "Clipping radius", zh: "裁剪半径" },
      min: 0.25,
      max: 3,
      step: 0.25,
      default: 1,
      format: (v) => `×${v}`,
    },
    aggregate: (updates, { previous, param }) => centeredClip(updates, previous, param),
  },
  {
    id: "fltrust",
    name: { en: "FLTrust" },
    description: {
      en: "The server trains on a small clean dataset of its own and trusts each client by how closely its update points the same way.",
      zh: "服务器用自己的一小份干净数据训练出参考更新，客户端的方向越接近它，就越被信任。",
    },
    aggregate: (updates, { rootUpdate }) => trustBootstrap(updates, rootUpdate()),
  },
];

export function getAggregator(id: string): Aggregator {
  return AGGREGATORS.find((a) => a.id === id) ?? AGGREGATORS[0];
}

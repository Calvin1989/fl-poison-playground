import { describe, expect, it } from "vitest";
import { AGGREGATORS, getAggregator } from "../src/core/aggregators";
import { defaultConfig, fromHash, toHash, updateConfig } from "../src/core/config";
import { Experiment } from "../src/core/experiment";
import { createMlp } from "../src/core/model";
import { createRng, dirichlet } from "../src/core/random";
import { SCENARIOS } from "../src/core/scenarios";
import { Simulation } from "../src/core/simulation";
import { getSweep, runSweep } from "../src/core/sweep";

const vecs = (...rows: number[][]) => rows.map((r) => Float64Array.from(r));
const context = (f: number, param = 0, root = [1, 1]) => ({
  f,
  param,
  rng: createRng(1),
  previous: new Float64Array(2),
  rootUpdate: () => Float64Array.from(root),
});
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("random", () => {
  it("is reproducible", () => {
    const a = createRng(7);
    const b = createRng(7);
    expect([a.next(), a.next(), a.normal()]).toEqual([b.next(), b.next(), b.normal()]);
  });

  it("draws Dirichlet vectors that sum to 1", () => {
    const p = dirichlet(createRng(3), 0.1, 4);
    expect(sum(p)).toBeCloseTo(1, 10);
  });
});

describe("aggregators", () => {
  const updates = vecs([1, 10], [2, 20], [3, 30], [100, -100]);

  it("median ignores one large outlier", () => {
    const { update, influence } = getAggregator("median").aggregate(updates, context(1));
    expect(Array.from(update)).toEqual([2.5, 15]);
    expect(sum(influence)).toBeCloseTo(1);
  });

  it("trimmed mean drops f values on each side", () => {
    const { update } = getAggregator("trimmed-mean").aggregate(updates, context(1));
    expect(Array.from(update)).toEqual([2.5, 15]);
  });

  it("krum never picks the outlier", () => {
    const { influence } = getAggregator("krum").aggregate(updates, context(1));
    expect(influence[3]).toBe(0);
    expect(sum(influence)).toBeCloseTo(1);
  });

  it("centered clipping limits how far one client can pull", () => {
    const { update } = getAggregator("centered-clipping").aggregate(updates, context(1, 1));
    expect(Math.abs(update[0])).toBeLessThan(20);
  });

  it("FLTrust ignores updates pointing away from the server's own", () => {
    const { influence } = getAggregator("fltrust").aggregate(updates, context(1, 0, [1, 10]));
    expect(influence[3]).toBe(0);
    expect(sum(influence)).toBeCloseTo(1);
  });

  it("bucketing spreads influence over every client", () => {
    const { influence } = getAggregator("bucketing").aggregate(updates, context(1, 2));
    expect(sum(influence)).toBeCloseTo(1);
  });
});

describe("model", () => {
  it("matches a numerical gradient", () => {
    const model = createMlp([4], 3);
    const params = model.init(createRng(5));
    const batch = [
      { x: 0.3, y: -0.2, label: 0 },
      { x: -0.5, y: 0.7, label: 2 },
    ];
    const grad = new Float64Array(model.size);
    model.lossAndGradient(params, batch, grad);
    const scratch = new Float64Array(model.size);
    const h = 1e-6;
    for (const i of [0, 5, model.size - 1]) {
      const plus = new Float64Array(params);
      const minus = new Float64Array(params);
      plus[i] += h;
      minus[i] -= h;
      const numeric = (model.lossAndGradient(plus, batch, scratch) - model.lossAndGradient(minus, batch, scratch)) / (2 * h);
      expect(grad[i]).toBeCloseTo(numeric, 5);
    }
  });
});

describe("config", () => {
  it("survives a round trip through the URL", () => {
    const config = updateConfig(defaultConfig(), { dataset: "xor", attack: "ipm", aggregator: "bucketing", clients: 17 });
    expect(fromHash(toHash(config))).toEqual(config);
  });

  it("falls back to valid values", () => {
    const config = fromHash("data=nope&n=999&attack=ghost");
    expect(config.dataset).toBe("blobs");
    expect(config.clients).toBe(50);
    expect(config.attack).toBe("none");
  });
});

/** The scenarios make claims in their text. Keep them true. */
describe("scenarios", () => {
  const finalAccuracy = (id: string, rounds: number, change = {}) => {
    const scenario = SCENARIOS.find((s) => s.id === id)!;
    const sim = new Simulation(updateConfig(scenario.config, change));
    for (let r = 0; r < rounds; r++) sim.step();
    return sim.accuracy[sim.round];
  };

  it("sign flipping breaks FedAvg but not Median", () => {
    expect(finalAccuracy("sign-flip", 40)).toBeLessThan(0.5);
    expect(finalAccuracy("sign-flip", 40, { aggregator: "median" })).toBeGreaterThan(0.9);
  });

  it("ALIE beats Median only on Non-IID data, and Bucketing holds", () => {
    expect(finalAccuracy("alie-iid", 100)).toBeGreaterThan(0.8);
    expect(finalAccuracy("alie-noniid", 100)).toBeLessThan(0.7);
    expect(finalAccuracy("bucketing", 100)).toBeGreaterThan(0.8);
  });
});

describe("experiment", () => {
  it("keeps progress when only the selected rule changes", () => {
    const experiment = new Experiment(defaultConfig());
    experiment.step();
    experiment.step();
    const restarted = experiment.configure(updateConfig(experiment.config, { aggregator: "krum" }));
    expect(restarted).toBe(false);
    expect(experiment.selected.config.aggregator).toBe("krum");
    expect(experiment.round).toBe(2);
  });

  it("starts over when the setup changes", () => {
    const experiment = new Experiment(defaultConfig());
    experiment.step();
    expect(experiment.configure(updateConfig(experiment.config, { alpha: 1 }))).toBe(true);
    expect(experiment.round).toBe(0);
  });
});

describe("sweep and export", () => {
  it("yields one point per value with every rule scored", () => {
    const sweep = getSweep("malicious");
    const points = [...runSweep(defaultConfig(), sweep, 3)];
    expect(points.map((p) => p.index)).toEqual(sweep.values.map((_, i) => i));
    for (const p of points) {
      expect(Object.keys(p.scores)).toHaveLength(AGGREGATORS.length);
      Object.values(p.scores).forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    }
  });

  it("exports one row per round plus a header", () => {
    const experiment = new Experiment(defaultConfig());
    experiment.step();
    const [header, ...rows] = experiment.table();
    expect(header[0]).toBe("round");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveLength(header.length);
  });
});

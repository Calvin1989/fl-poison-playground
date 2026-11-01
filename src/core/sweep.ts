import { AGGREGATORS } from "./aggregators";
import { IID_ALPHA, KNOBS, updateConfig, type Config } from "./config";
import { Experiment } from "./experiment";
import type { Localized } from "./text";

/** One setting varied over a fixed list of values, everything else held at the current config. */
export interface Sweep {
  id: string;
  name: Localized;
  values: readonly number[];
  apply(value: number): Partial<Config>;
  format(value: number): string;
}

export const SWEEPS: readonly Sweep[] = [
  {
    id: "alpha",
    name: { en: "Non-IID level", zh: "Non-IID 程度" },
    values: [IID_ALPHA, 3, 1, 0.5, 0.3, 0.1, 0.05],
    apply: (alpha) => ({ alpha }),
    format: (v) => KNOBS.alpha.format(v),
  },
  {
    id: "malicious",
    name: { en: "Malicious clients", zh: "恶意客户端比例" },
    values: [0, 0.1, 0.2, 0.3, 0.4],
    apply: (maliciousShare) => ({ maliciousShare }),
    format: (v) => `${Math.round(v * 100)}%`,
  },
];

export function getSweep(id: string): Sweep {
  return SWEEPS.find((s) => s.id === id) ?? SWEEPS[0];
}

/** Rounds per point. Shorter than a full run so a sweep finishes in seconds. */
export const SWEEP_ROUNDS = 60;
/** A point's score is the mean accuracy over this many final rounds, which smooths out noise. */
const SCORE_WINDOW = 10;

export interface SweepPoint {
  index: number;
  /** Final accuracy per rule id. */
  scores: Record<string, number>;
  reference: number;
}

const score = (accuracy: readonly number[]) => {
  const tail = accuracy.slice(-SCORE_WINDOW);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
};

/** Runs every rule at every value of the sweep, yielding one point at a time. */
export function* runSweep(config: Config, sweep: Sweep, rounds = SWEEP_ROUNDS): Generator<SweepPoint> {
  for (const [index, value] of sweep.values.entries()) {
    const experiment = new Experiment(updateConfig(config, sweep.apply(value)));
    for (let r = 0; r < rounds; r++) experiment.step();
    const scores = Object.fromEntries(AGGREGATORS.map((a) => [a.id, score(experiment.runs.get(a.id)!.accuracy)]));
    yield { index, scores, reference: score(experiment.reference.accuracy) };
  }
}

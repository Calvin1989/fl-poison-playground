import { getAttack } from "./attacks";
import { getAggregator } from "./aggregators";
import { DATASETS } from "./datasets";
import { clampToKnob, type Knob } from "./knob";

/** Everything that defines a run. Two runs with the same Config are identical. */
export interface Config {
  dataset: string;
  /** Dirichlet concentration of each client's class mix. At IID_ALPHA and above the split is IID. */
  alpha: number;
  clients: number;
  attack: string;
  maliciousShare: number;
  /** Value of the selected attack's knob. */
  strength: number;
  aggregator: string;
  /** Value of the selected aggregator's knob. */
  aggregatorParam: number;
  epochs: number;
  learningRate: number;
  seed: number;
}

export const IID_ALPHA = 100;

/** Fixed settings that are not worth a control. */
export const FIXED = {
  hidden: [10, 10],
  samplesPerClient: 40,
  batchSize: 10,
  testPerClass: 150,
  /** Size of the clean, class-balanced dataset the server holds for FLTrust. Same as one client's, so its update has a comparable length. */
  rootSize: 40,
  maxRounds: 100,
} as const;

const percent = (v: number) => `${Math.round(v * 100)}%`;

export const KNOBS = {
  alpha: {
    label: { en: "Non-IID level (α)", zh: "Non-IID 程度 (α)" },
    min: 0.05,
    max: IID_ALPHA,
    step: 0,
    default: 0.1,
    log: true,
    format: (v: number) => (v >= IID_ALPHA ? "IID" : v < 1 ? v.toFixed(2) : v.toFixed(1)),
  },
  clients: { label: { en: "Clients", zh: "客户端数量" }, min: 10, max: 50, step: 1, default: 30 },
  maliciousShare: { label: { en: "Malicious clients", zh: "恶意客户端比例" }, min: 0, max: 0.45, step: 0.05, default: 0.3, format: percent },
  epochs: { label: { en: "Local epochs", zh: "本地训练轮数" }, min: 1, max: 5, step: 1, default: 2 },
  learningRate: { label: { en: "Learning rate", zh: "学习率" }, min: 0.01, max: 0.5, step: 0.01, default: 0.1, format: (v: number) => v.toFixed(2) },
} satisfies Record<string, Knob>;

export function defaultConfig(): Config {
  const attack = getAttack("alie");
  const aggregator = getAggregator("median");
  return {
    dataset: "moons",
    alpha: KNOBS.alpha.default,
    clients: KNOBS.clients.default,
    attack: attack.id,
    maliciousShare: KNOBS.maliciousShare.default,
    strength: attack.strength?.default ?? 0,
    aggregator: aggregator.id,
    aggregatorParam: aggregator.param?.default ?? 0,
    epochs: KNOBS.epochs.default,
    learningRate: KNOBS.learningRate.default,
    seed: 1,
  };
}

/** Number of malicious clients; also what the server assumes as f. */
export function maliciousCount(config: Config): number {
  return Math.round(config.maliciousShare * config.clients);
}

/** Apply a partial change and keep the result valid. Switching attack or rule resets its knob. */
export function updateConfig(current: Config, change: Partial<Config>): Config {
  const next = { ...current, ...change };
  if (change.attack && change.attack !== current.attack && change.strength === undefined) {
    next.strength = getAttack(next.attack).strength?.default ?? 0;
  }
  if (change.aggregator && change.aggregator !== current.aggregator && change.aggregatorParam === undefined) {
    next.aggregatorParam = getAggregator(next.aggregator).param?.default ?? 0;
  }
  return sanitize(next);
}

function sanitize(c: Config): Config {
  const attack = getAttack(c.attack);
  const aggregator = getAggregator(c.aggregator);
  return {
    dataset: DATASETS.some((d) => d.id === c.dataset) ? c.dataset : DATASETS[0].id,
    alpha: clampToKnob(KNOBS.alpha, c.alpha),
    clients: Math.round(clampToKnob(KNOBS.clients, c.clients)),
    attack: attack.id,
    maliciousShare: clampToKnob(KNOBS.maliciousShare, c.maliciousShare),
    strength: attack.strength ? clampToKnob(attack.strength, c.strength) : 0,
    aggregator: aggregator.id,
    aggregatorParam: aggregator.param ? clampToKnob(aggregator.param, c.aggregatorParam) : 0,
    epochs: Math.round(clampToKnob(KNOBS.epochs, c.epochs)),
    learningRate: clampToKnob(KNOBS.learningRate, c.learningRate),
    seed: Number.isFinite(c.seed) ? Math.round(c.seed) : 1,
  };
}

// --- URL hash, so any setup can be shared as a link -------------------------

const URL_KEYS: Record<keyof Config, string> = {
  dataset: "data",
  alpha: "alpha",
  clients: "n",
  attack: "attack",
  maliciousShare: "bad",
  strength: "s",
  aggregator: "rule",
  aggregatorParam: "p",
  epochs: "e",
  learningRate: "lr",
  seed: "seed",
};

const TEXT_FIELDS = new Set<keyof Config>(["dataset", "attack", "aggregator"]);

export function toHash(config: Config): string {
  const params = new URLSearchParams();
  for (const [field, key] of Object.entries(URL_KEYS) as [keyof Config, string][]) {
    params.set(key, String(config[field]));
  }
  return params.toString();
}

export function fromHash(hash: string): Config {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const base = defaultConfig();
  const parsed: Record<string, string | number> = { ...base };
  for (const [field, key] of Object.entries(URL_KEYS) as [keyof Config, string][]) {
    const raw = params.get(key);
    if (raw === null) continue;
    parsed[field] = TEXT_FIELDS.has(field) ? raw : Number(raw);
  }
  // Fill knob defaults when only the attack or rule was given.
  const config = parsed as unknown as Config;
  if (!params.has(URL_KEYS.strength)) config.strength = getAttack(config.attack).strength?.default ?? 0;
  if (!params.has(URL_KEYS.aggregatorParam)) config.aggregatorParam = getAggregator(config.aggregator).param?.default ?? 0;
  return sanitize(config);
}

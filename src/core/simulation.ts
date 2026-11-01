import { getAttack, type Attack } from "./attacks";
import { getAggregator, type Aggregator } from "./aggregators";
import { trainLocally } from "./client";
import { FIXED, IID_ALPHA, maliciousCount, type Config } from "./config";
import { balancedSet, getDataset, type Dataset, type Sample } from "./datasets";
import { createMlp, type Model } from "./model";
import { createRng, deriveSeed, dirichlet, pick, shuffle, type Rng } from "./random";
import { addScaled, mean, type Vec } from "./vector";

export interface Client {
  id: number;
  malicious: boolean;
  /** Training data as the client actually uses it (labels already flipped for label flipping). */
  data: Sample[];
  /** Share of each class in the client's original data. */
  classMix: number[];
}

export interface Round {
  round: number;
  accuracy: number;
  updates: Vec[];
  influence: number[];
  aggregate: Vec;
  benignMean: Vec;
}

/**
 * One federated training run. Each random part (data split, who is malicious,
 * local training, the server's own randomness) draws from its own seeded stream.
 */
export class Simulation {
  readonly dataset: Dataset;
  readonly model: Model;
  readonly clients: Client[];
  readonly testSet: Sample[];
  /** Accuracy after each round; index 0 is the untrained model. */
  readonly accuracy: number[] = [];
  params: Vec;
  last: Round | null = null;

  /** Clean, class-balanced data the server keeps for rules like FLTrust. */
  readonly rootSet: Sample[];
  /** What the server applied last round. */
  private previous: Vec;
  private readonly attack: Attack;
  private readonly aggregator: Aggregator;
  private readonly rng: { train: Rng; attack: Rng; server: Rng };

  constructor(readonly config: Config) {
    const stream = (name: string) => createRng(deriveSeed(config.seed, name));
    this.dataset = getDataset(config.dataset);
    this.model = createMlp(FIXED.hidden, this.dataset.classes);
    this.attack = getAttack(config.attack);
    this.aggregator = getAggregator(config.aggregator);
    this.rng = { train: stream("train"), attack: stream("attack"), server: stream("server") };

    this.clients = splitData(stream("data"), stream("malicious"), this.dataset, config, this.attack);
    this.testSet = balancedSet(stream("test"), this.dataset, FIXED.testPerClass);
    this.rootSet = balancedSet(stream("root"), this.dataset, Math.ceil(FIXED.rootSize / this.dataset.classes));
    this.params = this.model.init(stream("init"));
    this.previous = new Float64Array(this.model.size);
    this.accuracy.push(this.model.accuracy(this.params, this.testSet));
  }

  get round(): number {
    return this.accuracy.length - 1;
  }

  get finished(): boolean {
    return this.round >= FIXED.maxRounds;
  }

  step(): Round {
    const { config, model, attack } = this;
    const training = { epochs: config.epochs, learningRate: config.learningRate, batchSize: FIXED.batchSize };

    const updates = this.clients.map((c) => trainLocally(model, this.params, c.data, training, this.rng.train));
    const benign = updates.filter((_, i) => !this.clients[i].malicious);
    const benignMean = mean(benign);

    if (attack.craft) {
      const context = { benign, strength: config.strength, rng: this.rng.attack };
      this.clients.forEach((c, i) => {
        if (c.malicious) updates[i] = attack.craft!(updates[i], context);
      });
    }

    const { update, influence } = this.aggregator.aggregate(updates, {
      f: maliciousCount(config),
      param: config.aggregatorParam,
      rng: this.rng.server,
      previous: this.previous,
      rootUpdate: () => trainLocally(model, this.params, this.rootSet, training, this.rng.server),
    });
    addScaled(this.params, update, 1);
    this.previous = update;

    const accuracy = model.accuracy(this.params, this.testSet);
    this.accuracy.push(accuracy);
    this.last = { round: this.round, accuracy, updates, influence, aggregate: update, benignMean };
    return this.last;
  }
}

function splitData(dataRng: Rng, maliciousRng: Rng, dataset: Dataset, config: Config, attack: Attack): Client[] {
  const k = dataset.classes;
  const uniform = Array.from({ length: k }, () => 1 / k);

  // A fixed random order decides who turns malicious, so raising the share adds clients without reshuffling.
  const order = shuffle(maliciousRng, Array.from({ length: config.clients }, (_, i) => i));
  const malicious = new Set(order.slice(0, maliciousCount(config)));

  return Array.from({ length: config.clients }, (_, id) => {
    const mix = config.alpha >= IID_ALPHA ? uniform : dirichlet(dataRng, config.alpha, k);
    const original = Array.from({ length: FIXED.samplesPerClient }, () => dataset.sample(dataRng, pick(dataRng, mix)));
    const counts = new Array<number>(k).fill(0);
    original.forEach((s) => counts[s.label]++);

    const isMalicious = malicious.has(id);
    const data =
      isMalicious && attack.poisonLabel
        ? original.map((s) => ({ ...s, label: attack.poisonLabel!(s.label, k) }))
        : original;
    return { id, malicious: isMalicious, data, classMix: counts.map((c) => c / original.length) };
  });
}

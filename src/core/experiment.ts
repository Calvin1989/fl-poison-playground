import { AGGREGATORS, getAggregator } from "./aggregators";
import { toHash, updateConfig, type Config } from "./config";
import { Simulation } from "./simulation";

/** The setup one rule runs with: the shared config, with that rule and its own knob. */
function configFor(config: Config, aggregatorId: string): Config {
  const param =
    aggregatorId === config.aggregator ? config.aggregatorParam : (getAggregator(aggregatorId).param?.default ?? 0);
  return updateConfig(config, { aggregator: aggregatorId, aggregatorParam: param });
}

/**
 * Runs every aggregation rule side by side on the same setup, plus a clean
 * reference (plain FedAvg, nobody attacks). One rule is "selected" for the
 * detailed views; switching it does not restart anything.
 */
export class Experiment {
  config: Config;
  runs = new Map<string, Simulation>();
  reference!: Simulation;

  constructor(config: Config) {
    this.config = config;
    this.restart();
  }

  get selected(): Simulation {
    return this.runs.get(this.config.aggregator)!;
  }

  get round(): number {
    return this.reference.round;
  }

  get finished(): boolean {
    return this.reference.finished;
  }

  step(): void {
    if (this.finished) return;
    this.runs.forEach((run) => run.step());
    this.reference.step();
  }

  restart(): void {
    this.runs = new Map(AGGREGATORS.map((a) => [a.id, new Simulation(configFor(this.config, a.id))]));
    this.reference = new Simulation(updateConfig(this.config, { attack: "none", aggregator: "fedavg" }));
  }

  /** Accuracy after every round so far, one column per rule plus the clean reference. Header row first. */
  table(): [string[], ...number[][]] {
    const ids = AGGREGATORS.map((a) => a.id);
    const rows = Array.from({ length: this.round + 1 }, (_, r) => [
      r,
      ...ids.map((id) => this.runs.get(id)!.accuracy[r]),
      this.reference.accuracy[r],
    ]);
    return [["round", ...ids, "clean_fedavg"], ...rows];
  }

  /**
   * Switch to a new config. Progress is kept when every run would be built
   * exactly as it already is (for example, only the selected rule changed).
   * Returns true when the runs had to start over.
   */
  configure(config: Config): boolean {
    const unchanged = AGGREGATORS.every((a) => toHash(configFor(config, a.id)) === toHash(this.runs.get(a.id)!.config));
    this.config = config;
    if (!unchanged) this.restart();
    return !unchanged;
  }
}

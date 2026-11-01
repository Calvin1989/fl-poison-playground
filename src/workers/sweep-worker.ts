/// <reference lib="webworker" />
import type { Config } from "../core/config";
import { getSweep, runSweep, type SweepPoint } from "../core/sweep";

/** Sweeps take seconds, so they run here, off the page's main thread. */
export interface SweepRequest {
  config: Config;
  sweepId: string;
}

export type SweepMessage = { type: "point"; point: SweepPoint } | { type: "done" };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<SweepRequest>) => {
  const { config, sweepId } = event.data;
  for (const point of runSweep(config, getSweep(sweepId))) {
    scope.postMessage({ type: "point", point } satisfies SweepMessage);
  }
  scope.postMessage({ type: "done" } satisfies SweepMessage);
};

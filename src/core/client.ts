import type { Sample } from "./datasets";
import type { Model } from "./model";
import { shuffle, type Rng } from "./random";
import { addScaled, sub, type Vec } from "./vector";

export interface LocalTraining {
  epochs: number;
  learningRate: number;
  batchSize: number;
}

/**
 * Train a copy of the global model on one client's data with minibatch SGD.
 * Returns the update the client sends back: local weights minus global weights.
 */
export function trainLocally(
  model: Model,
  global: Vec,
  data: readonly Sample[],
  training: LocalTraining,
  rng: Rng,
): Vec {
  const params = new Float64Array(global);
  const grad = new Float64Array(model.size);
  const order = data.map((_, i) => i);

  for (let epoch = 0; epoch < training.epochs; epoch++) {
    shuffle(rng, order);
    for (let start = 0; start < order.length; start += training.batchSize) {
      const batch = order.slice(start, start + training.batchSize).map((i) => data[i]);
      model.lossAndGradient(params, batch, grad);
      addScaled(params, grad, -training.learningRate);
    }
  }
  return sub(params, global);
}

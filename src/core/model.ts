import type { Sample } from "./datasets";
import type { Rng } from "./random";
import type { Vec } from "./vector";

/** Where one dense layer lives inside the flat parameter vector. */
export interface LayerSlice {
  inputs: number;
  outputs: number;
  weightOffset: number; // outputs x inputs, row-major
  biasOffset: number;
}

export interface Model {
  readonly size: number;
  readonly classes: number;
  /** Where each layer sits inside the flat parameter vector. */
  readonly layers: readonly LayerSlice[];
  init(rng: Rng): Vec;
  /** Class probabilities for one point, written into `out`. */
  predict(params: Vec, x: number, y: number, out: Float64Array): void;
  /** Mean cross-entropy over the batch; the mean gradient is written into `grad`. */
  lossAndGradient(params: Vec, batch: readonly Sample[], grad: Vec): number;
  accuracy(params: Vec, samples: readonly Sample[]): number;
}

/**
 * A small multilayer perceptron: 2 inputs, tanh hidden layers, softmax output.
 * All parameters sit in one Float64Array, which is what clients send to the server.
 */
export function createMlp(hidden: readonly number[], classes: number): Model {
  const sizes = [2, ...hidden, classes];
  const layers: LayerSlice[] = [];
  let size = 0;
  for (let l = 0; l + 1 < sizes.length; l++) {
    const inputs = sizes[l];
    const outputs = sizes[l + 1];
    layers.push({ inputs, outputs, weightOffset: size, biasOffset: size + inputs * outputs });
    size += inputs * outputs + outputs;
  }

  // Scratch buffers, reused across calls.
  const activations = sizes.map((n) => new Float64Array(n));
  const deltas = sizes.map((n) => new Float64Array(n));

  function forward(params: Vec, x: number, y: number): Float64Array {
    activations[0][0] = x;
    activations[0][1] = y;
    layers.forEach((layer, l) => {
      const input = activations[l];
      const output = activations[l + 1];
      const isLast = l === layers.length - 1;
      for (let o = 0; o < layer.outputs; o++) {
        let z = params[layer.biasOffset + o];
        const row = layer.weightOffset + o * layer.inputs;
        for (let i = 0; i < layer.inputs; i++) z += params[row + i] * input[i];
        output[o] = isLast ? z : Math.tanh(z);
      }
      if (isLast) softmaxInPlace(output);
    });
    return activations[activations.length - 1];
  }

  return {
    size,
    classes,
    layers,

    init(rng) {
      const params = new Float64Array(size);
      for (const layer of layers) {
        const spread = Math.sqrt(2 / (layer.inputs + layer.outputs));
        for (let i = 0; i < layer.inputs * layer.outputs; i++) {
          params[layer.weightOffset + i] = spread * rng.normal();
        }
      }
      return params;
    },

    predict(params, x, y, out) {
      out.set(forward(params, x, y));
    },

    lossAndGradient(params, batch, grad) {
      grad.fill(0);
      let loss = 0;
      const last = layers.length;
      for (const sample of batch) {
        const probs = forward(params, sample.x, sample.y);
        loss -= Math.log(Math.max(probs[sample.label], 1e-12));

        // Softmax + cross-entropy gradient at the output.
        for (let k = 0; k < classes; k++) deltas[last][k] = probs[k] - (k === sample.label ? 1 : 0);

        for (let l = last - 1; l >= 0; l--) {
          const layer = layers[l];
          const input = activations[l];
          const delta = deltas[l + 1];
          for (let o = 0; o < layer.outputs; o++) {
            const row = layer.weightOffset + o * layer.inputs;
            grad[layer.biasOffset + o] += delta[o];
            for (let i = 0; i < layer.inputs; i++) grad[row + i] += delta[o] * input[i];
          }
          if (l === 0) break;
          // Back through tanh: (W^T delta) * (1 - a^2)
          const prev = deltas[l];
          for (let i = 0; i < layer.inputs; i++) {
            let s = 0;
            for (let o = 0; o < layer.outputs; o++) s += params[layer.weightOffset + o * layer.inputs + i] * delta[o];
            prev[i] = s * (1 - input[i] * input[i]);
          }
        }
      }
      const n = Math.max(batch.length, 1);
      for (let i = 0; i < size; i++) grad[i] /= n;
      return loss / n;
    },

    accuracy(params, samples) {
      let correct = 0;
      for (const s of samples) {
        const probs = forward(params, s.x, s.y);
        if (argmax(probs) === s.label) correct++;
      }
      return samples.length ? correct / samples.length : 0;
    },
  };
}

export function argmax(values: ArrayLike<number>): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}

function softmaxInPlace(z: Float64Array): void {
  let max = -Infinity;
  for (const v of z) max = Math.max(max, v);
  let sum = 0;
  for (let i = 0; i < z.length; i++) {
    z[i] = Math.exp(z[i] - max);
    sum += z[i];
  }
  for (let i = 0; i < z.length; i++) z[i] /= sum;
}

import type { Knob } from "./knob";
import type { Rng } from "./random";
import type { Localized } from "./text";
import { mean, scale, std, type Vec } from "./vector";

export interface AttackContext {
  /** Updates of the honest clients this round. Colluding attacks are assumed to see them. */
  benign: readonly Vec[];
  strength: number;
  rng: Rng;
}

/**
 * How a malicious client misbehaves. An attack either changes the client's
 * training labels (data poisoning) or replaces the update it sends (model poisoning).
 * To add an attack, add one entry to ATTACKS; the controls pick it up automatically.
 */
export interface Attack {
  id: string;
  name: Localized;
  /** One plain sentence shown under the picker. */
  description: Localized;
  strength?: Knob;
  poisonLabel?(label: number, classes: number): number;
  craft?(own: Vec, context: AttackContext): Vec;
}

const times = (v: number) => `×${v}`;

export const ATTACKS: readonly Attack[] = [
  {
    id: "none",
    name: { en: "No attack", zh: "无攻击" },
    description: { en: "Every client trains honestly.", zh: "所有客户端都诚实训练。" },
  },
  {
    id: "label-flip",
    name: { en: "Label flipping", zh: "标签翻转" },
    description: {
      en: "Malicious clients train on data with the labels swapped.",
      zh: "恶意客户端把训练数据的标签互换后再训练。",
    },
    poisonLabel: (label, classes) => classes - 1 - label,
  },
  {
    id: "sign-flip",
    name: { en: "Sign flipping", zh: "符号翻转" },
    description: {
      en: "Malicious clients send their update pointing the opposite way, scaled up.",
      zh: "恶意客户端把自己的更新反向，并放大后发送。",
    },
    strength: { label: { en: "Scale", zh: "放大倍数" }, min: 1, max: 10, step: 0.5, default: 4, format: times },
    craft: (own, { strength }) => scale(own, -strength),
  },
  {
    id: "noise",
    name: { en: "Random noise", zh: "随机噪声" },
    description: {
      en: "Malicious clients send random vectors instead of a real update.",
      zh: "恶意客户端发送随机向量，而不是真实的更新。",
    },
    strength: { label: { en: "Noise level", zh: "噪声强度" }, min: 0.5, max: 10, step: 0.5, default: 3, format: times },
    craft: (own, { benign, strength, rng }) => {
      const rms = Math.sqrt(benign.reduce((s, v) => s + v.reduce((a, b) => a + b * b, 0), 0) / (benign.length * own.length));
      return own.map(() => strength * rms * rng.normal());
    },
  },
  {
    id: "alie",
    name: { en: "A little is enough", zh: "A little is enough (ALIE)" },
    description: {
      en: "Colluding clients send the honest mean, pushed back a few standard deviations in every coordinate. It looks normal but slows or reverses learning.",
      zh: "合谋的客户端发送诚实均值，但每个坐标都往回推几个标准差。看起来很正常，却会拖慢甚至逆转训练。",
    },
    strength: { label: { en: "Shift (z)", zh: "偏移量 (z)" }, min: 0.2, max: 3, step: 0.1, default: 2, format: (v) => v.toFixed(1) },
    // Each coordinate moves against the sign of the honest mean, the common
    // direction-aware form of ALIE (Baruch et al., 2019).
    craft: (_own, { benign, strength }) => {
      const mu = mean(benign);
      const sigma = std(benign, mu);
      return mu.map((m, i) => m - Math.sign(m) * strength * sigma[i]);
    },
  },
  {
    id: "ipm",
    name: { en: "Inner product manipulation", zh: "内积操纵 (IPM)" },
    description: {
      en: "Colluding clients all send the same small negative multiple of the honest mean. Rules that look for agreement, like Krum, can end up following them.",
      zh: "合谋的客户端都发送同一个向量：诚实均值乘以一个小的负数。Krum 这类寻找“多数一致”的规则，反而会跟着它们走。",
    },
    strength: { label: { en: "Epsilon", zh: "系数 ε" }, min: 0.1, max: 5, step: 0.1, default: 0.5, format: (v) => v.toFixed(1) },
    craft: (_own, { benign, strength }) => scale(mean(benign), -strength),
  },
];

export function getAttack(id: string): Attack {
  return ATTACKS.find((a) => a.id === id) ?? ATTACKS[0];
}

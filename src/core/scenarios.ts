import { defaultConfig, updateConfig, type Config } from "./config";
import type { Localized } from "./text";

/** A ready-made setup that shows one effect. Each was checked over several seeds. */
export interface Scenario {
  id: string;
  title: Localized;
  /** What to look for, in one or two sentences. */
  text: Localized;
  config: Config;
}

const make = (id: string, title: Localized, text: Localized, change: Partial<Config>): Scenario => ({
  id,
  title,
  text,
  config: updateConfig(defaultConfig(), change),
});

export const SCENARIOS: readonly Scenario[] = [
  make(
    "sign-flip",
    { en: "Plain averaging has no defense", zh: "直接平均毫无防御" },
    {
      en: "Six of thirty clients flip their updates. FedAvg follows them and accuracy collapses. Switch the rule to Median and it recovers.",
      zh: "30 个客户端里有 6 个把更新反向。FedAvg 跟着它们走，准确率崩溃。把规则换成 Median 就能恢复。",
    },
    { dataset: "blobs", alpha: 100, attack: "sign-flip", maliciousShare: 0.2, aggregator: "fedavg" },
  ),
  make(
    "alie-iid",
    { en: "ALIE against Median, IID data", zh: "IID 数据：ALIE 对 Median" },
    {
      en: "Honest clients agree with each other, so the attackers' shift is small and Median keeps the model on track.",
      zh: "诚实客户端之间意见一致，攻击者能做的偏移很小，Median 能让模型保持正常。",
    },
    { dataset: "moons", alpha: 100, attack: "alie", maliciousShare: 0.3, aggregator: "median" },
  ),
  make(
    "alie-noniid",
    { en: "The same attack, Non-IID data", zh: "同样的攻击，换成 Non-IID 数据" },
    {
      en: "Honest updates now spread out, which gives the attackers room to hide. Median ends up near chance.",
      zh: "诚实更新之间差异变大，攻击者有了藏身的空间。Median 最后掉到接近随机猜测。",
    },
    { dataset: "moons", alpha: 0.1, attack: "alie", maliciousShare: 0.3, aggregator: "median" },
  ),
  make(
    "bucketing",
    { en: "Bucketing under the same attack", zh: "同样的攻击下用 Bucketing" },
    {
      en: "Averaging small random buckets first makes honest updates agree again, so the median across buckets holds up.",
      zh: "先把客户端随机分成小桶、桶内平均，诚实更新又变得一致，对各桶取中位数就能守住。",
    },
    { dataset: "moons", alpha: 0.1, attack: "alie", maliciousShare: 0.3, aggregator: "bucketing" },
  ),
];

import type { Localized } from "../core/text";

export type Lang = "en" | "zh";
export const LANGS: readonly { id: Lang; name: string }[] = [
  { id: "en", name: "English" },
  { id: "zh", name: "中文" },
];

const CLASS_LETTERS = ["A", "B", "C"];
const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

const en = {
  description:
    "Poisoning attacks and robust aggregation in federated learning, running in your browser. See why defenses break on Non-IID data.",
  lede: "Some clients in federated learning lie about their updates. Pick an attack, pick a defense, and watch the global model hold or break. Everything runs in your browser.",
  tagline: "Poisoning attacks and robust aggregation in federated learning, in your browser",
  language: "Language",

  run: "Run",
  pause: "Pause",
  runAgain: "Run again",
  step: "Step",
  reset: "Reset",
  copyLink: "Copy link",
  linkCopied: "Link copied",
  copyFailed: "Copy failed",
  round: "Round",
  testAccuracy: "Test accuracy",
  cleanFedAvg: "Clean FedAvg",

  stageData: "Data",
  stageDataNote: "Which data, and how it is split.",
  stageClients: "Clients",
  stageClientsNote: "Each trains locally. Some are malicious.",
  stageServer: "Server",
  stageServerNote: "Combines the updates into one.",
  stageModel: "Global model",
  stageModelNote: "What everyone gets back.",

  dataset: "Dataset",
  attack: "Attack",
  rule: "Aggregation rule",
  localTraining: "Local training",
  splitIid: "Every client sees all classes in equal amounts.",
  splitMild: "Clients see all classes, in somewhat different amounts.",
  splitLean: "Most clients lean toward one or two classes.",
  splitExtreme: "Most clients see almost only one class.",

  className: (k: number) => `Class ${CLASS_LETTERS[k]}`,
  malicious: "Malicious",
  clientStripNote: "One column per client. Top: its class mix. Bottom: its share of this round's update.",
  influenceEmpty: "Influence shows once training starts",
  clientStripLabel: "Class mix and influence of every client",

  legendHonest: "Honest client, colored by its main class",
  legendMalicious: "Malicious client",
  legendHollow: "Hollow: almost ignored",
  legendHonestMean: "Honest mean",
  legendServer: "Server's update",
  cosine: (c: number) => `Server vs. honest mean, cosine: ${c.toFixed(2)}`,
  updatesEmpty: "Press Run to start training",
  updateMapLabel: "Client updates projected to two dimensions",

  testDataCaption: "Points show the test set. Hover a client to see its own data.",
  trainingData: (n: number, malicious: boolean) => `Training data of client ${n}${malicious ? " (malicious)" : ""}`,
  boundaryLabel: "Decision regions of the global model",

  client: (n: number, malicious: boolean) => `Client ${n}${malicious ? ", malicious" : ""}`,
  classMix: (parts: string) => `Class mix: ${parts}`,
  influence: (share: number, equal: number) => `Influence this round: ${pct(share)} (equal share ${pct(equal)})`,
  mostlyClass: (k: number, share: number) => `Mostly class ${CLASS_LETTERS[k]} (${pct(share, 0)})`,
  roundN: (r: number) => `Round ${r}`,
  seriesValue: (name: string, v: number) => `${name}: ${pct(v)}`,

  compareTitle: "Every rule, same setup",
  compareNote: "Same clients and attackers, one run per rule. Black: test accuracy by round. Grey: clean FedAvg. Click a rule to inspect it above.",
  compareLabel: (rule: string) => `Test accuracy of ${rule} per round`,

  downloadCsv: "Download CSV",

  sweepTitle: "Sweep one setting",

  sweepNote: (rounds: number) =>
    `Runs every rule at each value of one setting, keeping everything else as set above. Each point is the mean test accuracy over the last 10 of ${rounds} rounds. The grey line is clean FedAvg.`,
  sweepVary: "Vary",
  sweepRun: "Run sweep",
  sweepStop: "Stop",
  sweepIdle: "Not run yet.",
  sweepProgress: (done: number, total: number) => `Running: ${done} of ${total} values done`,
  sweepDone: "Done.",
  sweepStopped: "Stopped.",
  sweepStale: "Settings changed since this sweep. Run it again to update.",
  sweepLabel: (rule: string) => `Accuracy of ${rule} across the sweep`,
  sweepPoint: (setting: string, value: string) => `${setting}: ${value}`,
  sweepAxis: (setting: string, values: string[]) =>
    `${setting}, left to right: ${values.join(" → ")}. The number in each box is at ${values[values.length - 1]}.`,

  scenariosTitle: "Try these",
  scenariosIntro: "Each one loads a ready-made setup and starts it. Watch the update map and the comparison as it runs.",
  readingTitle: "How to read it",
  mapTitle: "The update map",
  mapText:
    "Every client's update is a point. The ring is the average of the honest clients, which is what the server should apply. The cross is what it actually applied. The map is turned so the cross always sits to the right of the ring, and the line between them is the true distance: the longer it is, the more the attackers steered this round.",
  mapHollow: "Hollow points are clients the rule gave almost no weight to.",
  noniidTitle: "Why Non-IID matters",
  noniidText:
    "Robust rules like Median and Krum assume honest updates agree with each other. When every client sees mostly one class, honest updates point in different directions, and attackers can sit inside that spread without looking unusual. Drag the Non-IID slider and watch the honest cloud open up.",
  referenceTitle: "The clean reference",
  referenceText:
    "The grey line in the accuracy charts is plain FedAvg on the same clients with nobody attacking. The gap between it and your run is the damage done by the attack, by the defense, or by both.",
  credits:
    'Inspired by <a href="https://playground.tensorflow.org">TensorFlow Playground</a>. MIT licensed. <a href="https://github.com/Calvin1989/fl-poison-playground#add-your-own-defense">Add your own defense</a>.',
};

export type Messages = typeof en;

const zh: Messages = {
  description: "在浏览器里运行的联邦学习投毒攻击与鲁棒聚合演示。看看防御方法为什么会在 Non-IID 数据上失效。",
  lede: "联邦学习里，有些客户端会在更新上撒谎。选一种攻击、选一种防御，看全局模型是守住了还是崩了。所有计算都在你的浏览器里完成。",
  tagline: "在浏览器里演示联邦学习的投毒攻击与鲁棒聚合",
  language: "语言",

  run: "运行",
  pause: "暂停",
  runAgain: "重新运行",
  step: "单步",
  reset: "重置",
  copyLink: "复制链接",
  linkCopied: "已复制",
  copyFailed: "复制失败",
  round: "轮次",
  testAccuracy: "测试准确率",
  cleanFedAvg: "无攻击 FedAvg",

  stageData: "数据",
  stageDataNote: "用什么数据，怎么分给客户端。",
  stageClients: "客户端",
  stageClientsNote: "各自本地训练，其中一些是恶意的。",
  stageServer: "服务器",
  stageServerNote: "把所有更新合并成一个。",
  stageModel: "全局模型",
  stageModelNote: "最后发回给所有人的模型。",

  dataset: "数据集",
  attack: "攻击方式",
  rule: "聚合规则",
  localTraining: "本地训练",
  splitIid: "每个客户端看到的各类别数据一样多。",
  splitMild: "每个客户端都能看到所有类别，只是数量有些不同。",
  splitLean: "大多数客户端偏向一两个类别。",
  splitExtreme: "大多数客户端几乎只看到一个类别。",

  className: (k) => `类别 ${CLASS_LETTERS[k]}`,
  malicious: "恶意",
  clientStripNote: "每一列是一个客户端。上半部分：它的类别构成。下半部分：它在本轮更新里所占的权重。",
  influenceEmpty: "开始训练后显示权重",
  clientStripLabel: "每个客户端的类别构成和权重",

  legendHonest: "诚实客户端，颜色是它的主要类别",
  legendMalicious: "恶意客户端",
  legendHollow: "空心：几乎被忽略",
  legendHonestMean: "诚实均值",
  legendServer: "服务器的更新",
  cosine: (c) => `服务器更新与诚实均值的余弦：${c.toFixed(2)}`,
  updatesEmpty: "点击“运行”开始训练",
  updateMapLabel: "投影到二维的客户端更新",

  testDataCaption: "图中的点是测试集。把鼠标移到某个客户端上，可以看它自己的数据。",
  trainingData: (n, malicious) => `客户端 ${n} 的训练数据${malicious ? "（恶意）" : ""}`,
  boundaryLabel: "全局模型的决策区域",

  client: (n, malicious) => `客户端 ${n}${malicious ? "（恶意）" : ""}`,
  classMix: (parts) => `类别构成：${parts}`,
  influence: (share, equal) => `本轮权重：${pct(share)}（平均分配为 ${pct(equal)}）`,
  mostlyClass: (k, share) => `主要是类别 ${CLASS_LETTERS[k]}（${pct(share, 0)}）`,
  roundN: (r) => `第 ${r} 轮`,
  seriesValue: (name, v) => `${name}：${pct(v)}`,

  compareTitle: "同一设置下的所有规则",
  compareNote: "同样的客户端和攻击者，每种规则各跑一次。黑线是每一轮的测试准确率，灰线是无攻击的 FedAvg。点一个规则，上方的图就切换到它。",
  compareLabel: (rule) => `${rule} 每一轮的测试准确率`,

  downloadCsv: "下载 CSV",

  sweepTitle: "敏感性扫描",

  sweepNote: (rounds) =>
    `让一个设置依次取不同的值，每个值下所有规则各跑一次，其余设置保持上面的选择。每个点是 ${rounds} 轮中最后 10 轮的平均测试准确率。灰线是无攻击的 FedAvg。`,
  sweepVary: "扫描",
  sweepRun: "开始扫描",
  sweepStop: "停止",
  sweepIdle: "还没有运行。",
  sweepProgress: (done, total) => `正在运行：已完成 ${done} / ${total} 个取值`,
  sweepDone: "完成。",
  sweepStopped: "已停止。",
  sweepStale: "上面的设置已经改过了，重新扫描才会更新结果。",
  sweepLabel: (rule) => `${rule} 在扫描中的准确率`,
  sweepPoint: (setting, value) => `${setting}：${value}`,
  sweepAxis: (setting, values) => `${setting}从左到右：${values.join(" → ")}。每个格子右上角的数字是取 ${values[values.length - 1]} 时的结果。`,

  scenariosTitle: "可以试试",
  scenariosIntro: "每个场景会载入一组设置并开始运行。运行时可以留意更新分布图和下方的规则对比。",
  readingTitle: "怎么看这些图",
  mapTitle: "更新分布图",
  mapText:
    "每个客户端的更新是一个点。圆圈是诚实客户端的平均值，也就是服务器本该采用的更新；叉号是服务器实际采用的更新。图会旋转到让叉号总在圆圈右边，两者之间的线段就是真实距离：线越长，说明攻击者这一轮把模型带偏得越多。",
  mapHollow: "空心的点，表示聚合规则几乎没给它权重。",
  noniidTitle: "为什么 Non-IID 很关键",
  noniidText:
    "Median、Krum 这类鲁棒规则都假设诚实更新彼此相近。当每个客户端大多只看到一个类别时，诚实更新会指向不同方向，攻击者藏在这片分散的点里也不显眼。拖动 Non-IID 滑块，可以看到诚实更新慢慢散开。",
  referenceTitle: "无攻击参照",
  referenceText:
    "准确率图里的灰线，是同一批客户端在没有攻击时用普通 FedAvg 训练的结果。它和你这次运行之间的差距，就是攻击、防御或两者一起造成的损失。",
  credits:
    '灵感来自 <a href="https://playground.tensorflow.org">TensorFlow Playground</a>。MIT 协议。<a href="https://github.com/Calvin1989/fl-poison-playground/blob/main/README.zh-CN.md#添加你自己的防御方法">添加你自己的防御方法</a>。',
};

const MESSAGES: Record<Lang, Messages> = { en, zh };

// --- Current language ------------------------------------------------------

const STORAGE_KEY = "fl-poison-playground.lang";

function initialLang(): Lang {
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (fromUrl === "en" || fromUrl === "zh") return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    // Storage can be blocked; fall through to the browser language.
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();

export function lang(): Lang {
  return current;
}

/** The message table for the current language. */
export function t(): Messages {
  return MESSAGES[current];
}

/** Pick the current language from a Localized value, falling back to English. */
export function tr(text: Localized): string {
  return text[current] ?? text.en;
}

export function setLang(next: Lang): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not remembered, but the switch still works for this visit.
  }
  listeners.forEach((l) => l());
}

export function onLanguageChange(listener: () => void): void {
  listeners.add(listener);
}

/**
 * Keep an element's text (or one attribute) in the current language.
 * Bindings on elements that have left the page are dropped on the next switch.
 */
export function bindText(element: Element, text: () => string, attribute?: string): void {
  const apply = () => (attribute ? element.setAttribute(attribute, text()) : (element.textContent = text()));
  apply();
  const listener = () => (element.isConnected ? apply() : listeners.delete(listener));
  listeners.add(listener);
}

// lib/nlp.ts
// Tiny intent classifier with dynamic TFJS import and versioned caching.

export type Sample = { text: string; intent: string };
export type TrainStats = { accuracy: number; loss: number; epochs: number };

let tf: any = null;
let vocab: string[] = [];
let labels: string[] = [];
let model: any = null;

function tokenize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}
function buildVocab(samples: Sample[]) {
  const set = new Set<string>();
  samples.forEach(s => tokenize(s.text).forEach(t => set.add(t)));
  return Array.from(set).sort();
}
function vectorize(text: string) {
  const tks = tokenize(text);
  const vec = new Array(vocab.length).fill(0);
  tks.forEach(t => { const i = vocab.indexOf(t); if (i >= 0) vec[i] += 1; });
  const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
  return vec.map(v => v / norm);
}
function toXY(samples: Sample[]) {
  const xs = samples.map(s => vectorize(s.text));
  const ys = samples.map(s => {
    const y = new Array(labels.length).fill(0);
    y[labels.indexOf(s.intent)] = 1;
    return y;
  });
  // @ts-ignore
  return { xs: tf.tensor2d(xs), ys: tf.tensor2d(ys) };
}
function buildModel(inputDim: number, numClasses: number) {
  // @ts-ignore
  const m = tf.sequential();
  m.add(tf.layers.dense({ inputShape: [inputDim], units: 32, activation: "relu" }));
  m.add(tf.layers.dropout({ rate: 0.2 }));
  m.add(tf.layers.dense({ units: numClasses, activation: "softmax" }));
  m.compile({ optimizer: tf.train.adam(0.01), loss: "categoricalCrossentropy", metrics: ["accuracy"] });
  return m;
}
async function loadTf() {
  if (!tf) tf = await import("@tensorflow/tfjs");
}
function hash(str: string) {
  let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
function storageKey(vocabArr: string[]) {
  const sig = hash(vocabArr.join(" "));
  return `sportiq_intent_v3_${vocabArr.length}_${sig}`;
}
async function purgeOldModels(keepKey: string) {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("tensorflowjs_models/sportiq_intent_"));
    for (const k of keys) {
      const clean = k.replace("tensorflowjs_models/", "");
      if (clean !== keepKey) {
        await tf.io.removeModel(`localstorage://${clean}`);
      }
    }
  } catch {}
}

export async function ensureModel(samples: Sample[]): Promise<TrainStats> {
  await loadTf();
  labels = Array.from(new Set(samples.map(s => s.intent))).sort();
  vocab = buildVocab(samples);
  const key = storageKey(vocab);

  // try load a matching model
  try {
    model = await tf.loadLayersModel(`localstorage://${key}`);
    return { accuracy: 1, loss: 0, epochs: 0 };
  } catch {}

  await purgeOldModels(key);

  const { xs, ys } = toXY(samples);
  model = buildModel(vocab.length, labels.length);
  const history = await model.fit(xs, ys, { epochs: 25, batchSize: 8, validationSplit: 0.2, shuffle: true, verbose: 0 });
  await model.save(`localstorage://${key}`);

  const acc = (history.history.val_accuracy?.at(-1) ?? history.history.accuracy?.at(-1) ?? 0) as number;
  const loss = (history.history.val_loss?.at(-1) ?? history.history.loss?.at(-1) ?? 0) as number;
  xs.dispose(); ys.dispose();
  return { accuracy: acc, loss, epochs: 25 };
}

export async function predictIntent(text: string): Promise<{ intent: string; confidence: number }> {
  await loadTf();
  if (!model) throw new Error("Model not ready");
  try {
    // @ts-ignore
    const x = tf.tensor2d([vectorize(text)]);
    // @ts-ignore
    const logits = model.predict(x);
    const probs = await logits.data();
    x.dispose(); logits.dispose();
    const arr = Array.from(probs) as number[];
    const max = Math.max(...arr);
    const idx = arr.indexOf(max);
    return { intent: labels[idx], confidence: max };
  } catch (e: any) {
    // Shape mismatch recovery: clear cache and force retrain next turn
    try {
      const ls = Object.keys(localStorage).filter(k => k.startsWith("tensorflowjs_models/sportiq_intent_"));
      for (const k of ls) await tf.io.removeModel(`localstorage://${k.replace("tensorflowjs_models/", "")}`);
    } catch {}
    throw e;
  }
}

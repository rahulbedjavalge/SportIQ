// scripts/train_intents.mjs
// SportIQ offline intent training with stratified split and clear metrics
// Pure TFJS CPU backend so it runs on Node 22

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import fs from "fs";

// tiny seeded RNG + shuffle so runs are repeatable
function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

(async () => {
  console.log("▶ Starting SportIQ intent training (stratified)...");
  await tf.setBackend("cpu");
  await tf.ready();
  console.log("• TFJS backend:", tf.getBackend());

  // load data
  const samples = JSON.parse(fs.readFileSync("./data/intents.json", "utf-8"));

  // tokenizer must match app/lib/nlp.ts
  const tokenize = s =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

  const labels = Array.from(new Set(samples.map(s => s.intent))).sort();
  const labelToIdx = Object.fromEntries(labels.map((l, i) => [l, i]));
  const vocab = Array.from(new Set(samples.flatMap(s => tokenize(s.text)))).sort();

  const vectorize = text => {
    const vec = new Array(vocab.length).fill(0);
    tokenize(text).forEach(t => {
      const i = vocab.indexOf(t);
      if (i >= 0) vec[i] += 1;
    });
    const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
    return vec.map(v => v / norm);
  };

  console.log(`• samples: ${samples.length}, intents: ${labels.length}, vocab: ${vocab.length}`);

  // stratified split per intent
  const rng = mulberry32(4243087); // deterministic split
  const byIntent = new Map();
  for (const s of samples) {
    const arr = byIntent.get(s.intent) || [];
    arr.push(s);
    byIntent.set(s.intent, arr);
  }

  const train = [];
  const val = [];
  const VAL_RATIO = 0.2;

  for (const intent of labels) {
    const arr = seededShuffle([...byIntent.get(intent)], rng);
    const nVal = Math.max(1, Math.round(arr.length * VAL_RATIO));
    const valPart = arr.slice(0, nVal);
    const trainPart = arr.slice(nVal);
    if (trainPart.length === 0 && valPart.length > 1) {
      trainPart.push(valPart.pop());
    }
    train.push(...trainPart);
    val.push(...valPart);
  }

  const makeXY = list => {
    const xs = tf.tensor2d(list.map(s => vectorize(s.text)));
    const ys = tf.tensor2d(list.map(s => {
      const y = new Array(labels.length).fill(0);
      y[labelToIdx[s.intent]] = 1;
      return y;
    }));
    return { xs, ys };
  };

  const { xs: xsTrain, ys: ysTrain } = makeXY(train);
  const { xs: xsVal, ys: ysVal } = makeXY(val);

  console.log(`• stratified split  train: ${train.length}  val: ${val.length}`);

  // model same as app
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [vocab.length], units: 32, activation: "relu" }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: labels.length, activation: "softmax" }));
  model.compile({ optimizer: tf.train.adam(0.01), loss: "categoricalCrossentropy", metrics: ["accuracy"] });

  const EPOCHS = 25;
  const BATCH = 8;
  console.log(`• epochs: ${EPOCHS}, batch: ${BATCH}, optimizer: Adam(0.01)`);

  // manual train loop with per epoch validation
  const accHist = [];
  const valAccHist = [];
  const lossHist = [];
  const valLossHist = [];

  for (let e = 0; e < EPOCHS; e++) {
    const h = await model.fit(xsTrain, ysTrain, { epochs: 1, batchSize: BATCH, shuffle: true, verbose: 0 });
    const trainAcc = Number(h.history.acc?.[0] ?? h.history.accuracy?.[0] ?? 0);
    const trainLoss = Number(h.history.loss?.[0] ?? 0);

    const [valLossT, valAccT] = model.evaluate(xsVal, ysVal, { verbose: 0 });
    const vLoss = Number((await valLossT.data())[0]);
    const vAcc = Number((await valAccT.data())[0]);

    accHist.push(trainAcc);
    valAccHist.push(vAcc);
    lossHist.push(trainLoss);
    valLossHist.push(vLoss);

    const ep = String(e + 1).padStart(2, "0");
    console.log(`epoch ${ep} | acc ${trainAcc.toFixed(4)} val_acc ${vAcc.toFixed(4)} | loss ${trainLoss.toFixed(4)} val_loss ${vLoss.toFixed(4)}`);
  }

  // final metrics on val
  const [trainLossT, trainAccT] = model.evaluate(xsTrain, ysTrain, { verbose: 0 });
  const [valLossT,   valAccT]   = model.evaluate(xsVal, ysVal,   { verbose: 0 });
  const trainLoss = Number((await trainLossT.data())[0]);
  const trainAcc  = Number((await trainAccT.data())[0]);
  const valLoss   = Number((await valLossT.data())[0]);
  const valAcc    = Number((await valAccT.data())[0]);

  // predictions on validation set
  const logitsVal = model.predict(xsVal);
  const predsVal = Array.from((await logitsVal.array()));
  logitsVal.dispose();

  const yTrueVal = val.map(s => labelToIdx[s.intent]);
  const yPredVal = predsVal.map(p => p.indexOf(Math.max(...p)));

  // confusion matrix
  const K = labels.length;
  const cm = Array.from({ length: K }, () => new Array(K).fill(0));
  for (let i = 0; i < yTrueVal.length; i++) cm[yTrueVal[i]][yPredVal[i]]++;

  // per intent metrics
  const per = [];
  for (let c = 0; c < K; c++) {
    const tp = cm[c][c];
    const fn = cm[c].reduce((a, b, j) => a + (j === c ? 0 : b), 0);
    let fp = 0;
    for (let r = 0; r < K; r++) if (r !== c) fp += cm[r][c];
    const support = cm[c].reduce((a, b) => a + b, 0);
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    per.push({ intent: labels[c], support, precision, recall, f1 });
  }
  const macroP = per.reduce((a, r) => a + r.precision, 0) / K;
  const macroR = per.reduce((a, r) => a + r.recall, 0) / K;
  const macroF1 = per.reduce((a, r) => a + r.f1, 0) / K;

  // print summary for PPT
  console.log("\n========== TRAINING SUMMARY ==========");
  console.log(`final train acc: ${trainAcc.toFixed(4)}  final val acc: ${valAcc.toFixed(4)}`);
  console.log(`final train loss: ${trainLoss.toFixed(4)}  final val loss: ${valLoss.toFixed(4)}`);
  console.log(`vocab size: ${vocab.length}  intents: ${labels.length}  trainable params: ${model.countParams()}`);
  console.log("--------------------------------------");
  console.log(`macro precision: ${macroP.toFixed(4)}  macro recall: ${macroR.toFixed(4)}  macro F1: ${macroF1.toFixed(4)}`);

  console.log("\nPer intent metrics on validation:");
  per.sort((a, b) => b.f1 - a.f1).forEach(r => {
    console.log(`${r.intent.padEnd(20)} | support ${String(r.support).padStart(2)} | P ${r.precision.toFixed(2)} R ${r.recall.toFixed(2)} F1 ${r.f1.toFixed(2)}`);
  });

  console.log("\nValidation confusion matrix (rows=true, cols=pred):");
  const header = "           " + labels.map(l => l.slice(0, 3).padStart(3)).join(" ");
  console.log(header);
  for (let i = 0; i < K; i++) {
    const row = cm[i].map(n => String(n).padStart(3)).join(" ");
    console.log(labels[i].slice(0, 10).padEnd(10), row);
  }
  console.log("======================================\n");

  // save JSON report for your submission
  const report = {
    backend: tf.getBackend(),
    samples: samples.length,
    intents: labels.length,
    vocab: vocab.length,
    epochs: EPOCHS,
    params: model.countParams(),
    histories: {
      acc: accHist,
      valAcc: valAccHist,
      loss: lossHist,
      valLoss: valLossHist
    },
    final: {
      trainAcc, valAcc, trainLoss, valLoss,
      macro: { precision: macroP, recall: macroR, f1: macroF1 },
      perIntent: per, confusion: cm, labels
    }
  };
  fs.mkdirSync("./models", { recursive: true });
  fs.writeFileSync("./models/intent_metrics.json", JSON.stringify(report, null, 2));

  xsTrain.dispose(); ysTrain.dispose(); xsVal.dispose(); ysVal.dispose();
  console.log("✔ done. Saved metrics to models/intent_metrics.json");
})().catch(err => {
  console.error("✖ training failed:", err?.message || err);
  process.exit(1);
});

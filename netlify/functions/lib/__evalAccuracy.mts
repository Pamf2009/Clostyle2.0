// Ferramenta de avaliação offline: mede a MESMA acurácia leave-one-out que
// /api/ml/stats calcula em produção, mas rodando localmente contra a paleta
// semente atual — sem precisar de nenhum Blob store real. Serve pra iterar
// na paleta/pesos de distância até bater uma meta de acurácia.
// Rode com: npx tsx netlify/functions/lib/__evalAccuracy.mts
//
// Espelha exatamente os mesmos limites de netlify/functions/ml-stats.mts
// (MAX_EVAL_SAMPLE / MAX_NEIGHBOR_POOL) — se um mudar, o outro precisa
// mudar junto, senão essa ferramenta para de refletir o que roda em produção.
import { rgbToHsl, colorDistance, type RgbColor } from "./colorModel.mts";
import { categoryDistance, type CategoryFeatures } from "./categoryModel.mts";
import { weightedKnnClassify } from "./knn.mts";
import { SEED_COLORS, SEED_CATEGORIES } from "./seedData.mts";

const MAX_EVAL_SAMPLE = 150;
const MAX_NEIGHBOR_POOL = 1500;

interface ColorRow { r: number; g: number; b: number; h: number; s: number; l: number; label: string; weight: number }
interface CategoryRow extends CategoryFeatures { label: string; weight: number }

function buildColorRows(): ColorRow[] {
  return SEED_COLORS.map(([label, r, g, b]) => ({ r, g, b, ...rgbToHsl({ r, g, b } as RgbColor), label, weight: 1 }));
}
function buildCategoryRows(): CategoryRow[] {
  return SEED_CATEGORIES.map(([label, aspectRatio, avgSaturation, avgBrightness, edgeDensity]) => ({
    label, aspectRatio, avgSaturation, avgBrightness, edgeDensity, weight: 1,
  }));
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomSampleExcluding<T>(rows: T[], exclude: T, count: number): T[] {
  const n = rows.length;
  const chosenIndexes = new Set<number>();
  const result: T[] = [];
  while (result.length < count) {
    const idx = Math.floor(Math.random() * n);
    const row = rows[idx];
    if (row === exclude || chosenIndexes.has(idx)) continue;
    chosenIndexes.add(idx);
    result.push(row);
  }
  return result;
}

function leaveOneOutAccuracy<T>(
  rows: T[],
  distanceFn: (a: T, b: T) => number,
  getLabel: (r: T) => string,
  getWeight: (r: T) => number,
  k: number
): { accuracy: number; evaluated: number; confusions: Map<string, Map<string, number>> } {
  const evalTargets = rows.length > MAX_EVAL_SAMPLE ? shuffle(rows).slice(0, MAX_EVAL_SAMPLE) : rows;
  let correct = 0;
  const confusions = new Map<string, Map<string, number>>();
  for (const target of evalTargets) {
    const rest = rows.length - 1 > MAX_NEIGHBOR_POOL ? randomSampleExcluding(rows, target, MAX_NEIGHBOR_POOL) : rows.filter((r) => r !== target);
    const result = weightedKnnClassify(rest, (r) => distanceFn(target, r), getLabel, getWeight, { k });
    const truth = getLabel(target);
    if (result.predicted === truth) {
      correct++;
    } else {
      if (!confusions.has(truth)) confusions.set(truth, new Map());
      const m = confusions.get(truth)!;
      m.set(result.predicted, (m.get(result.predicted) ?? 0) + 1);
    }
  }
  return { accuracy: correct / evalTargets.length, evaluated: evalTargets.length, confusions };
}

function printConfusions(title: string, confusions: Map<string, Map<string, number>>, topN = 25) {
  const rows: { truth: string; predicted: string; count: number }[] = [];
  for (const [truth, m] of confusions) {
    for (const [predicted, count] of m) rows.push({ truth, predicted, count });
  }
  rows.sort((a, b) => b.count - a.count);
  if (rows.length === 0) {
    console.log(`\n-- Sem confusões (${title}) --`);
    return;
  }
  console.log(`\n-- Top confusões (${title}) --`);
  rows.slice(0, topN).forEach((r) => console.log(`  ${r.truth} -> ${r.predicted}  (${r.count}x)`));
}

const t0 = performance.now();
const colorRows = buildColorRows();
const colorResult = leaveOneOutAccuracy(colorRows, (a, b) => colorDistance(a, b), (r) => r.label, (r) => r.weight, 9);
console.log(`COR: ${colorRows.length} exemplos (avaliados ${colorResult.evaluated}), acurácia leave-one-out (k=9) = ${(colorResult.accuracy * 100).toFixed(1)}%`);
printConfusions("cor", colorResult.confusions);

const categoryRows = buildCategoryRows();
const categoryResult = leaveOneOutAccuracy(categoryRows, (a, b) => categoryDistance(a, b), (r) => r.label, (r) => r.weight, 7);
console.log(`\nCATEGORIA: ${categoryRows.length} exemplos (avaliados ${categoryResult.evaluated}), acurácia leave-one-out (k=7) = ${(categoryResult.accuracy * 100).toFixed(1)}%`);
printConfusions("categoria", categoryResult.confusions);

console.log(`\n(tempo total: ${((performance.now() - t0) / 1000).toFixed(2)}s — deve ficar bem abaixo do timeout de uma function síncrona)`);

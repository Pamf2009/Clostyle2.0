// GET /api/ml/stats
// Alimenta o painel "Motor de IA" nas Configurações: tamanho da base de
// treinamento, quantas correções vieram do próprio usuário, uma estimativa
// de acurácia (validação cruzada leave-one-out, honesta e recalculada a cada
// chamada — cresce/melhora conforme mais exemplos entram) e as últimas
// correções registradas.
import type { Config } from "@netlify/functions";
import { json, serverError } from "./lib/http.mts";
import { colorDistance, getAllColorExamples, type ColorExample } from "./lib/colorModel.mts";
import { categoryDistance, getAllCategoryExamples, type CategoryExample } from "./lib/categoryModel.mts";
import { getRecentScanEvents } from "./lib/scanEvents.mts";
import { weightedKnnClassify } from "./lib/knn.mts";

const MAX_EVAL_SAMPLE = 150;

/** Validação cruzada leave-one-out: para cada exemplo, classifica usando
 * todos os OUTROS exemplos e verifica se acertou o próprio rótulo. Uma
 * amostra honesta (e crescente) de "quão bem a IA está indo" com os dados
 * reais que ela já viu. */
function leaveOneOutAccuracy<T>(
  rows: T[],
  distanceFn: (a: T, b: T) => number,
  getLabel: (row: T) => string,
  getWeight: (row: T) => number
): { accuracy: number | null; evaluated: number } {
  if (rows.length < 2) return { accuracy: null, evaluated: 0 };

  const sample = rows.length > MAX_EVAL_SAMPLE ? shuffle(rows).slice(0, MAX_EVAL_SAMPLE) : rows;
  let correct = 0;
  for (const target of sample) {
    const rest = rows.filter((r) => r !== target);
    const result = weightedKnnClassify(rest, (r) => distanceFn(target, r), getLabel, getWeight, { k: 9 });
    if (result.predicted === getLabel(target)) correct++;
  }
  return { accuracy: round(correct / sample.length), evaluated: sample.length };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "GET") {
    return json({ error: "Use GET" }, 400);
  }

  try {
    const [colorExamples, categoryExamples, recentEvents] = await Promise.all([
      getAllColorExamples(),
      getAllCategoryExamples(),
      getRecentScanEvents(15),
    ]);

    const colorAcc = leaveOneOutAccuracy(
      colorExamples,
      (a: ColorExample, b: ColorExample) => colorDistance(a, b),
      (r) => r.label,
      (r) => r.weight
    );
    const categoryAcc = leaveOneOutAccuracy(
      categoryExamples,
      (a: CategoryExample, b: CategoryExample) => categoryDistance(a, b),
      (r) => r.label,
      (r) => r.weight
    );

    return json({
      color: {
        trainingSetSize: colorExamples.length,
        fromUserCorrections: colorExamples.filter((e) => e.source === "user_feedback").length,
        estimatedAccuracy: colorAcc.accuracy,
        evaluatedOn: colorAcc.evaluated,
      },
      category: {
        trainingSetSize: categoryExamples.length,
        fromUserCorrections: categoryExamples.filter((e) => e.source === "user_feedback").length,
        estimatedAccuracy: categoryAcc.accuracy,
        evaluatedOn: categoryAcc.evaluated,
      },
      recentEvents: recentEvents.map((e) => ({
        predicted_color: e.predictedColor,
        corrected_color: e.correctedColor,
        predicted_category: e.predictedCategory,
        corrected_category: e.correctedCategory,
        color_confidence: e.colorConfidence,
        category_confidence: e.categoryConfidence,
        created_at: e.createdAt,
      })),
    });
  } catch (err) {
    return serverError(err);
  }
};

export const config: Config = {
  path: "/api/ml/stats",
};

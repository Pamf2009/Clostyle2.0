// GET /api/ml/stats
// Alimenta o painel "Motor de IA" nas Configurações: tamanho da base de
// treinamento, quantas correções vieram do próprio usuário, uma estimativa
// de acurácia (validação cruzada leave-one-out, honesta e recalculada a cada
// chamada — cresce/melhora conforme mais exemplos entram) e as últimas
// correções registradas.
import type { Config } from "@netlify/functions";
import { json, serverError } from "./lib/http.mts";
import { db } from "./lib/db.mts";
import { colorDistance, rgbToHsl } from "./lib/colorModel.mts";
import { weightedKnnClassify } from "./lib/knn.mts";

interface ColorRow { r: number; g: number; b: number; h: number; s: number; l: number; label: string; weight: number; source: string; }
interface CategoryRow { aspect_ratio: number; avg_saturation: number; avg_brightness: number; edge_density: number; label: string; weight: number; source: string; }

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
  for (let i = 0; i < sample.length; i++) {
    const target = sample[i];
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
    const database = db();

    const colorRows = (await database.sql`SELECT r, g, b, h, s, l, label, weight, source FROM color_training_examples`) as ColorRow[];
    const categoryRows = (await database.sql`SELECT aspect_ratio, avg_saturation, avg_brightness, edge_density, label, weight, source FROM category_training_examples`) as CategoryRow[];

    const colorAcc = leaveOneOutAccuracy(
      colorRows,
      (a, b) => colorDistance({ h: a.h, s: a.s, l: a.l }, { h: b.h, s: b.s, l: b.l }),
      (r) => r.label,
      (r) => r.weight
    );
    const categoryAcc = leaveOneOutAccuracy(
      categoryRows,
      (a, b) =>
        Math.sqrt(
          2.5 * (a.aspect_ratio - b.aspect_ratio) ** 2 +
            0.6 * (a.avg_saturation - b.avg_saturation) ** 2 +
            0.6 * (a.avg_brightness - b.avg_brightness) ** 2 +
            1 * (a.edge_density - b.edge_density) ** 2
        ),
      (r) => r.label,
      (r) => r.weight
    );

    // Guarda um snapshot para permitir gráfico de evolução no futuro.
    if (colorAcc.accuracy !== null) {
      await database.sql`INSERT INTO model_metrics (model_name, accuracy, total_examples) VALUES ('color', ${colorAcc.accuracy}, ${colorRows.length})`;
    }
    if (categoryAcc.accuracy !== null) {
      await database.sql`INSERT INTO model_metrics (model_name, accuracy, total_examples) VALUES ('category', ${categoryAcc.accuracy}, ${categoryRows.length})`;
    }

    const recentEvents = await database.sql`
      SELECT predicted_color, corrected_color, predicted_category, corrected_category,
             color_confidence, category_confidence, created_at
      FROM scan_events
      ORDER BY created_at DESC
      LIMIT 15
    `;

    const [colorCounts] = (await database.sql`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE source = 'user_feedback')::int AS from_user
      FROM color_training_examples
    `) as { total: number; from_user: number }[];
    const [categoryCounts] = (await database.sql`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE source = 'user_feedback')::int AS from_user
      FROM category_training_examples
    `) as { total: number; from_user: number }[];

    return json({
      color: {
        trainingSetSize: colorCounts?.total ?? 0,
        fromUserCorrections: colorCounts?.from_user ?? 0,
        estimatedAccuracy: colorAcc.accuracy,
        evaluatedOn: colorAcc.evaluated,
      },
      category: {
        trainingSetSize: categoryCounts?.total ?? 0,
        fromUserCorrections: categoryCounts?.from_user ?? 0,
        estimatedAccuracy: categoryAcc.accuracy,
        evaluatedOn: categoryAcc.evaluated,
      },
      recentEvents,
    });
  } catch (err) {
    return serverError(err);
  }
};

export const config: Config = {
  path: "/api/ml/stats",
};

// Classificador de CATEGORIA da peça (camiseta, calça, tênis, etc.) a partir
// de um vetor de características simples extraído da imagem no navegador
// (proporção largura/altura do enquadramento, saturação e brilho médios,
// densidade de bordas/textura). Sem uma peça de visão computacional pesada
// (rede neural treinada em milhões de fotos), este sinal é mais fraco que o
// de cor — por isso o limiar de confiança é mais exigente e o app sempre
// deixa o usuário confirmar/corrigir a categoria. Cada correção também vira
// um novo exemplo no banco, então a acurácia sobe com o uso real do app.
import { db } from "./db.mts";
import { weightedKnnClassify, type ClassificationResult } from "./knn.mts";

export interface CategoryFeatures {
  aspectRatio: number; // largura / altura do enquadramento
  avgSaturation: number; // 0..1
  avgBrightness: number; // 0..1
  edgeDensity: number; // 0..1, proxy de textura/estampa
}

interface CategoryExampleRow {
  aspect_ratio: number;
  avg_saturation: number;
  avg_brightness: number;
  edge_density: number;
  label: string;
  weight: number;
}

function categoryDistance(a: CategoryFeatures, b: CategoryExampleRow): number {
  // Aspect ratio é o sinal mais forte (roupas de baixo/vestidos costumam ser
  // bem mais altas que largas; calçados o oposto), por isso tem peso maior.
  const dAspect = a.aspectRatio - b.aspect_ratio;
  const dSat = a.avgSaturation - b.avg_saturation;
  const dBright = a.avgBrightness - b.avg_brightness;
  const dEdge = a.edgeDensity - b.edge_density;
  return Math.sqrt(2.5 * dAspect ** 2 + 0.6 * dSat ** 2 + 0.6 * dBright ** 2 + 1 * dEdge ** 2);
}

export async function classifyCategory(features: CategoryFeatures): Promise<ClassificationResult> {
  const database = db();
  const rows = (await database.sql`
    SELECT aspect_ratio, avg_saturation, avg_brightness, edge_density, label, weight
    FROM category_training_examples
  `) as CategoryExampleRow[];

  return weightedKnnClassify(
    rows,
    (row) => categoryDistance(features, row),
    (row) => row.label,
    (row) => row.weight,
    // Categoria é um sinal mais fraco que cor -> exige mais confiança antes
    // de assumir que acertou, senão pede revisão do usuário com mais frequência.
    { k: 7, reviewConfidenceThreshold: 0.62, closeCallRatioThreshold: 0.78 }
  );
}

export async function addCategoryExample(
  features: CategoryFeatures,
  label: string,
  source: "seed" | "user_feedback",
  itemId: string | null = null
): Promise<void> {
  const weight = source === "user_feedback" ? 3 : 1;
  const database = db();
  await database.sql`
    INSERT INTO category_training_examples
      (aspect_ratio, avg_saturation, avg_brightness, edge_density, hue, label, source, weight, item_id)
    VALUES
      (${features.aspectRatio}, ${features.avgSaturation}, ${features.avgBrightness}, ${features.edgeDensity}, 0, ${label}, ${source}, ${weight}, ${itemId})
  `;
}

export async function countCategoryExamples(): Promise<{ total: number; fromFeedback: number }> {
  const database = db();
  const [row] = (await database.sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE source = 'user_feedback')::int AS from_feedback
    FROM category_training_examples
  `) as { total: number; from_feedback: number }[];
  return { total: row?.total ?? 0, fromFeedback: row?.from_feedback ?? 0 };
}

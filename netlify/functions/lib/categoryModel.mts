// Classificador de CATEGORIA da peça (camiseta, calça, tênis, etc.) a partir
// de um vetor de características simples extraído da imagem no navegador
// (proporção largura/altura do enquadramento, saturação e brilho médios,
// densidade de bordas/textura). Sem uma peça de visão computacional pesada
// (rede neural treinada em milhões de fotos), este sinal é mais fraco que o
// de cor — por isso o limiar de confiança é mais exigente e o app sempre
// deixa o usuário confirmar/corrigir a categoria. Cada correção também vira
// um novo exemplo no banco, então a acurácia sobe com o uso real do app.
import { getBlobStore } from "./blobStore.mts";
import { weightedKnnClassify, type ClassificationResult } from "./knn.mts";
import { SEED_CATEGORIES, SEED_VERSION } from "./seedData.mts";

export interface CategoryFeatures {
  aspectRatio: number; // largura / altura do enquadramento
  avgSaturation: number; // 0..1
  avgBrightness: number; // 0..1
  edgeDensity: number; // 0..1, proxy de textura/estampa
}

export interface CategoryExample extends CategoryFeatures {
  label: string;
  source: "seed" | "user_feedback";
  weight: number;
  itemId: string | null;
  createdAt: string;
}

const STORE_NAME = "ml-category-examples";
const BLOB_KEY = "examples";
const META_KEY = "meta";
const MAX_EXAMPLES = 4000;

interface StoreMeta {
  seedVersion: number;
}

function seedExamples(): CategoryExample[] {
  return SEED_CATEGORIES.map(([label, aspectRatio, avgSaturation, avgBrightness, edgeDensity]) => ({
    label,
    aspectRatio,
    avgSaturation,
    avgBrightness,
    edgeDensity,
    source: "seed" as const,
    weight: 1,
    itemId: null,
    createdAt: new Date(0).toISOString(),
  }));
}

function seedIdentity(e: CategoryFeatures & { label: string }): string {
  return `${e.aspectRatio},${e.avgSaturation},${e.avgBrightness},${e.edgeDensity},${e.label}`;
}

/** Mesma lógica de "regar" um store antigo com exemplos semente novos que o
 * colorModel usa — ver o comentário lá para o raciocínio completo. */
async function loadExamples(): Promise<CategoryExample[]> {
  const store = getBlobStore(STORE_NAME);
  const existing = (await store.get(BLOB_KEY, { type: "json" })) as CategoryExample[] | null;
  const meta = (await store.get(META_KEY, { type: "json" })) as StoreMeta | null;

  if (!existing || !Array.isArray(existing) || existing.length === 0) {
    const seeded = seedExamples();
    await store.setJSON(BLOB_KEY, seeded);
    await store.setJSON(META_KEY, { seedVersion: SEED_VERSION });
    return seeded;
  }

  if (!meta || meta.seedVersion < SEED_VERSION) {
    const alreadyPresent = new Set(existing.filter((e) => e.source === "seed").map(seedIdentity));
    const newSeedEntries = seedExamples().filter((e) => !alreadyPresent.has(seedIdentity(e)));
    if (newSeedEntries.length > 0) {
      const merged = [...existing, ...newSeedEntries];
      await store.setJSON(BLOB_KEY, merged);
      await store.setJSON(META_KEY, { seedVersion: SEED_VERSION });
      return merged;
    }
    await store.setJSON(META_KEY, { seedVersion: SEED_VERSION });
  }

  return existing;
}

export function categoryDistance(a: CategoryFeatures, b: CategoryFeatures): number {
  // Aspect ratio é o sinal mais forte (roupas de baixo/vestidos costumam ser
  // bem mais altas que largas; calçados o oposto), por isso tem peso maior.
  const dAspect = a.aspectRatio - b.aspectRatio;
  const dSat = a.avgSaturation - b.avgSaturation;
  const dBright = a.avgBrightness - b.avgBrightness;
  const dEdge = a.edgeDensity - b.edgeDensity;
  return Math.sqrt(2.5 * dAspect ** 2 + 0.6 * dSat ** 2 + 0.6 * dBright ** 2 + 1 * dEdge ** 2);
}

export async function classifyCategory(features: CategoryFeatures): Promise<ClassificationResult> {
  const examples = await loadExamples();

  return weightedKnnClassify(
    examples,
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
  const store = getBlobStore(STORE_NAME);
  const examples = await loadExamples();
  const weight = source === "user_feedback" ? 3 : 1;

  examples.push({ ...features, label, source, weight, itemId, createdAt: new Date().toISOString() });

  const trimmed = examples.length > MAX_EXAMPLES ? examples.slice(examples.length - MAX_EXAMPLES) : examples;
  await store.setJSON(BLOB_KEY, trimmed);
}

export async function getAllCategoryExamples(): Promise<CategoryExample[]> {
  return loadExamples();
}

export async function countCategoryExamples(): Promise<{ total: number; fromFeedback: number }> {
  const examples = await loadExamples();
  return {
    total: examples.length,
    fromFeedback: examples.filter((e) => e.source === "user_feedback").length,
  };
}

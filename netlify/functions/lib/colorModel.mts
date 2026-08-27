// Classificador de COR da peça escaneada.
//
// Por que a versão anterior errava (ex.: blusa azul virava "Rosa")?
// Ela comparava a cor lida da câmera com só ~11 cores fixas usando distância
// euclidiana em RGB puro. RGB puro é dominado pelo BRILHO (luminosidade): sob
// luz ruim, um azul escuro pode ficar numericamente "mais perto" de um rosa
// escuro do que de um azul claro, mesmo tendo matiz completamente diferente.
//
// Aqui a distância é calculada em HSL e dá peso muito maior à diferença de
// MATIZ (hue, a "cor" em si) do que a brilho/saturação — o que é como o olho
// humano de fato distingue cores — e o conjunto de comparação cresce e se
// corrige sozinho a cada correção que o usuário faz (ver addColorExample).
import { getBlobStore } from "./blobStore.mts";
import { weightedKnnClassify, type ClassificationResult } from "./knn.mts";
import { SEED_COLORS, SEED_VERSION } from "./seedData.mts";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}
export interface Hsl {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

export function rgbToHsl({ r, g, b }: RgbColor): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn: h = 60 * (((gn - bn) / d) % 6); break;
      case gn: h = 60 * ((bn - rn) / d + 2); break;
      case bn: h = 60 * ((rn - gn) / d + 4); break;
    }
  }
  if (h < 0) h += 360;
  return { h, s, l };
}

export interface ColorExample extends Hsl, RgbColor {
  label: string;
  source: "seed" | "user_feedback";
  weight: number;
  itemId: string | null;
  createdAt: string;
}

const STORE_NAME = "ml-color-examples";
const BLOB_KEY = "examples";
const META_KEY = "meta";
// Limite generoso; mantém as mais recentes se estourar (a base semente tem
// ~41 mil exemplos sozinha desde o pedido de 1000 exemplos sintéticos por
// cor — ver seedData.mts). Como o corte é sempre pelas mais RECENTES,
// correções reais de usuário (user_feedback) nunca são as primeiras a cair;
// exemplos semente antigos são descartados antes.
const MAX_EXAMPLES = 60000;

interface StoreMeta {
  seedVersion: number;
}

function seedExamples(): ColorExample[] {
  return SEED_COLORS.map(([label, r, g, b]) => ({
    r, g, b,
    ...rgbToHsl({ r, g, b }),
    label,
    source: "seed" as const,
    weight: 1,
    itemId: null,
    createdAt: new Date(0).toISOString(),
  }));
}

function seedIdentity(e: { r: number; g: number; b: number; label: string }): string {
  return `${e.r},${e.g},${e.b},${e.label}`;
}

/** Carrega os exemplos de treinamento, populando a base semente na primeira
 * leitura, e "regando" stores mais antigos com exemplos semente novos
 * (quando SEED_VERSION sobe em seedData.mts) sem nunca tocar em exemplos
 * gravados a partir de correções reais do usuário (source: 'user_feedback'). */
async function loadExamples(): Promise<ColorExample[]> {
  const store = getBlobStore(STORE_NAME);
  const existing = (await store.get(BLOB_KEY, { type: "json" })) as ColorExample[] | null;
  const meta = (await store.get(META_KEY, { type: "json" })) as StoreMeta | null;

  if (!existing || !Array.isArray(existing) || existing.length === 0) {
    // Primeira vez que este store é lido (site novo / deploy preview novo):
    // popula com a base semente para o modelo já responder algo sensato.
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

export function hueDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2) % 360;
  return (diff > 180 ? 360 - diff : diff) / 180; // normalizado 0..1
}

// Pesos calibrados para priorizar matiz. Quando a saturação é muito baixa
// (cinza/preto/branco), o matiz é ruidoso, então o peso da luminosidade sobe
// dinamicamente na função de distância abaixo.
export function colorDistance(a: Hsl, b: Hsl): number {
  const dHue = hueDistance(a.h, b.h);
  const dSat = Math.abs(a.s - b.s);
  const dLight = Math.abs(a.l - b.l);

  // Se ambos têm baixa saturação, a diferença de matiz não é confiável
  // (tons de cinza têm matiz praticamente aleatório) — nesse caso o peso
  // decisivo passa a ser luminosidade/saturação.
  const avgSat = (a.s + b.s) / 2;
  const hueWeight = 2 + avgSat * 3; // 2 (neutros) .. 5 (cores vivas)

  return Math.sqrt(hueWeight * dHue ** 2 + 1.4 * dSat ** 2 + 1.1 * dLight ** 2);
}

export async function classifyColor(rgb: RgbColor): Promise<ClassificationResult> {
  const hsl = rgbToHsl(rgb);
  const examples = await loadExamples();

  return weightedKnnClassify(
    examples,
    (row) => colorDistance(hsl, row),
    (row) => row.label,
    (row) => row.weight,
    // maxNeighborDistance calibrado a partir da própria paleta semente: o
    // vizinho mais próximo de uma leitura que bate com uma cor conhecida
    // fica tipicamente < 0.08 (mesma classe, só variando iluminação); leituras
    // realmente ambíguas (ex.: azul bem escuro sob luz ruim, que fica com
    // baixa saturação e por isso "parece" neutro em RGB) ficam > 0.18. 0.12
    // fica confortavelmente no meio, sem gerar falsos "não sei" em leituras
    // normais — ver __selftest.mts, teste 3.
    { k: 9, reviewConfidenceThreshold: 0.55, closeCallRatioThreshold: 0.82, maxNeighborDistance: 0.12 }
  );
}

/** Grava um novo exemplo de treinamento — o coração do "aprender sozinho". */
export async function addColorExample(
  rgb: RgbColor,
  label: string,
  source: "seed" | "user_feedback",
  itemId: string | null = null
): Promise<void> {
  const store = getBlobStore(STORE_NAME);
  const examples = await loadExamples();
  const hsl = rgbToHsl(rgb);
  const weight = source === "user_feedback" ? 3 : 1;

  examples.push({ ...rgb, ...hsl, label, source, weight, itemId, createdAt: new Date().toISOString() });

  // Mantém as mais recentes se passar do limite (as mais antigas já
  // cumpriram seu papel de moldar exemplos futuros via correções acumuladas).
  const trimmed = examples.length > MAX_EXAMPLES ? examples.slice(examples.length - MAX_EXAMPLES) : examples;
  await store.setJSON(BLOB_KEY, trimmed);
}

export async function getAllColorExamples(): Promise<ColorExample[]> {
  return loadExamples();
}

export async function countColorExamples(): Promise<{ total: number; fromFeedback: number }> {
  const examples = await loadExamples();
  return {
    total: examples.length,
    fromFeedback: examples.filter((e) => e.source === "user_feedback").length,
  };
}

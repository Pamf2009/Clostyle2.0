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
import { db } from "./db.mts";
import { weightedKnnClassify, type ClassificationResult } from "./knn.mts";

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

interface ColorExampleRow {
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  l: number;
  label: string;
  weight: number;
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
  const database = db();
  const rows = (await database.sql`
    SELECT r, g, b, h, s, l, label, weight FROM color_training_examples
  `) as ColorExampleRow[];

  return weightedKnnClassify(
    rows,
    (row) => colorDistance(hsl, { h: row.h, s: row.s, l: row.l }),
    (row) => row.label,
    (row) => row.weight,
    { k: 9, reviewConfidenceThreshold: 0.55, closeCallRatioThreshold: 0.82 }
  );
}

/** Grava um novo exemplo de treinamento — o coração do "aprender sozinho". */
export async function addColorExample(
  rgb: RgbColor,
  label: string,
  source: "seed" | "user_feedback",
  itemId: string | null = null
): Promise<void> {
  const hsl = rgbToHsl(rgb);
  const weight = source === "user_feedback" ? 3 : 1;
  const database = db();
  await database.sql`
    INSERT INTO color_training_examples (r, g, b, h, s, l, label, source, weight, item_id)
    VALUES (${rgb.r}, ${rgb.g}, ${rgb.b}, ${hsl.h}, ${hsl.s}, ${hsl.l}, ${label}, ${source}, ${weight}, ${itemId})
  `;
}

export async function countColorExamples(): Promise<{ total: number; fromFeedback: number }> {
  const database = db();
  const [row] = (await database.sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE source = 'user_feedback')::int AS from_feedback
    FROM color_training_examples
  `) as { total: number; from_feedback: number }[];
  return { total: row?.total ?? 0, fromFeedback: row?.from_feedback ?? 0 };
}

// Dados semente do motor de IA: usados para popular as bases de treinamento
// de cor e categoria na primeira leitura (quando o Netlify Blob store ainda
// está vazio) e para ENRIQUECER stores que já existem (ver SEED_VERSION nos
// modelos), para o modelo já responder algo sensato antes de qualquer scan
// real do usuário. Depois disso, quem faz a base crescer é o próprio uso do
// app (ver colorModel.mts / categoryModel.mts).
//
// Ajuste de 2026-08-27: uma primeira tentativa de ampliar a paleta (~171
// tons, PR #4) na verdade DERRUBOU a acurácia medida (54% em vez de subir),
// porque adicionar muitos nomes de cor quase-idênticos (Bordô/Vinho,
// Areia/Bege/Nude/Off-White, Azul Bebê/Azul Claro...) cria classes que nem
// um humano distingue de forma consistente — o k-NN passa a confundi-las
// entre si. A correção foi medir com netlify/functions/lib/__evalAccuracy.mts
// (acurácia leave-one-out, a mesma conta de /api/ml/stats) e reprojetar a
// paleta em torno de dois princípios:
//   1. Poucos nomes por família de cor, bem espaçados entre si (matiz e/ou
//      luminosidade), em vez de muitas variações quase-sinônimas.
//   2. Amostras da MESMA cor ficam bem próximas umas das outras (só variam
//      um pouco em luminosidade — como a mesma peça sob luzes diferentes),
//      pra que os vizinhos mais próximos de um exemplo sejam quase sempre da
//      própria classe dele.

/** Versão da paleta semente. Bump sempre que SEED_COLORS ou SEED_CATEGORIES
 * mudar de forma significativa — os modelos usam isso pra saber quando
 * precisam "regar" um store que já existia com os exemplos novos, sem
 * duplicar o que já está lá nem tocar em exemplos de user_feedback. */
export const SEED_VERSION = 4;

// Pedido do usuário: 1000 exemplos sintéticos por rótulo (cor) e por
// categoria. Gerados com um PRNG determinístico (mesma seed sempre → mesmo
// resultado, reprodutível) espalhados dentro de uma faixa BEM estreita ao
// redor do centro de cada classe — é a mesma ideia de "lightingVariants" de
// antes, só que com muito mais pontos e variação contínua (não só 4
// fatores fixos) em vez de uniformemente aleatória: mais pontos no mesmo
// cluster ajudam o k-NN a ter um vizinho próximo pra praticamente qualquer
// leitura de câmera daquela cor/categoria, mas só ajudam de verdade se o
// cluster continuar coeso — se a faixa fosse larga o suficiente pra invadir
// o território de uma classe vizinha, viraria o mesmo problema do PR #4
// (mais dados quase-duplicados == mais confusão, não menos). Por isso a
// faixa aqui é deliberadamente mais estreita que a de antes.
const SAMPLES_PER_LABEL = 1000;

/** PRNG determinístico simples (mulberry32) — sem dependência externa, e
 * sempre gera a mesma sequência pra mesma seed (reprodutível). */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Gera SAMPLES_PER_LABEL variações "sob condições de câmera/luz um pouco
 * diferentes" de uma cor: perturba brilho (mais) e matiz/saturação (bem
 * pouco) mantendo o cluster coeso — fisicamente é o que mais varia entre
 * fotos da mesma peça. `seed` é derivado do próprio rótulo, então cada cor
 * tem uma sequência determinística e independente das outras.
 */
function denseColorVariants(label: string, r: number, g: number, b: number, seed: number): [string, number, number, number][] {
  const rand = mulberry32(seed);
  const out: [string, number, number, number][] = [];
  for (let i = 0; i < SAMPLES_PER_LABEL; i++) {
    // Brilho: até ±14% (equivalente ao intervalo dos 4 fatores manuais de
    // antes). Cada canal ganha um pouquinho de ruído independente também
    // (câmeras reais não escalam R/G/B de forma perfeitamente uniforme).
    const lightFactor = 0.86 + rand() * 0.28; // 0.86 .. 1.14
    const noise = () => (rand() - 0.5) * 6; // ±3 por canal
    out.push([
      label,
      clampByte(r * lightFactor + noise()),
      clampByte(g * lightFactor + noise()),
      clampByte(b * lightFactor + noise()),
    ]);
  }
  return out;
}

/** Hash simples de string -> inteiro, só pra derivar uma seed determinística
 * por rótulo (não precisa ser criptográfico, só estável). */
function seedFromLabel(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (Math.imul(h, 31) + label.charCodeAt(i)) | 0;
  }
  return h || 1;
}

/** Um representante por rótulo. Cada família de cor tem poucos nomes,
 * escolhidos para ficarem bem espaçados em matiz e/ou luminosidade — é essa
 * separação, mais do que a quantidade de nomes, que faz o classificador
 * acertar de verdade (ver comentário no topo do arquivo). */
const COLOR_CENTERS: [string, number, number, number][] = [
  // Neutros (ordenados por luminosidade, degraus grandes o suficiente pra
  // não se confundirem mesmo variando um pouco a exposição da foto)
  ['Preto', 8, 8, 9],
  ['Grafite', 40, 43, 48],
  ['Cinza Chumbo', 70, 74, 80],
  ['Cinza', 112, 118, 128],
  ['Cinza Claro', 168, 174, 183],
  ['Branco', 248, 248, 248],
  ['Off-White', 236, 232, 224],

  // Terrosos / marrons / bege (mesma família de matiz quente, separados
  // principalmente por luminosidade + leve variação de matiz)
  ['Marrom Café', 82, 46, 22],
  ['Marrom', 122, 66, 28],
  ['Caramelo', 178, 118, 62],
  ['Terracota', 183, 104, 70],
  ['Caqui', 172, 166, 112],
  ['Amarelo Mostarda', 196, 142, 30],
  // Nota: "Areia" foi removida como rótulo próprio — na prática é
  // indistinguível de "Bege" (mesma faixa de matiz/luminosidade), e mantê-la
  // separada só derrubava a acurácia sem ganho real de expressividade.
  ['Bege', 226, 205, 174],

  // Azuis (bem representados — é a cor mais comum em roupa e a do bug
  // original relatado)
  ['Azul Marinho', 18, 30, 70],
  ['Índigo', 58, 52, 178],
  ['Azul Royal', 32, 52, 168],
  ['Azul', 40, 130, 232],
  ['Azul Jeans', 78, 118, 158],
  ['Azul Petróleo', 18, 90, 100],
  ['Ciano', 32, 178, 196],
  ['Azul Claro', 172, 214, 253],

  // Verdes
  ['Verde Escuro', 18, 88, 50],
  ['Verde Militar', 78, 92, 48],
  ['Verde', 22, 168, 116],
  ['Verde Água', 42, 200, 180],
  ['Verde Limão', 158, 216, 58],

  // Vermelhos / rosas
  ['Vermelho Escuro', 118, 28, 28],
  ['Bordô', 96, 22, 38],
  ['Vermelho', 222, 58, 58],
  ['Rosa Choque', 224, 18, 190],
  ['Rosa', 228, 88, 150],
  ['Rosa Claro', 250, 210, 224],
  ['Coral', 250, 128, 60],
  ['Pêssego', 249, 180, 138],

  // Amarelos
  ['Amarelo', 232, 182, 20],
  ['Amarelo Claro', 250, 222, 110],

  // Roxos
  ['Roxo', 158, 78, 224],
  ['Lilás', 202, 186, 244],
  ['Ameixa', 92, 48, 92],

  // Metálicos / acessórios
  ['Dourado', 200, 164, 60],
  ['Prateado', 186, 186, 188],
];

/** Paleta semente final: cada rótulo vira SAMPLES_PER_LABEL amostras
 * próximas entre si (variação de "iluminação"), então o k-NN tem vizinhos
 * densos e bem coesos por classe desde o início — não só 4 como antes. */
export const SEED_COLORS: [string, number, number, number][] = COLOR_CENTERS.flatMap(([label, r, g, b]) =>
  denseColorVariants(label, r, g, b, seedFromLabel(label))
);

/** Centróides heurísticos por categoria: [rótulo, aspectRatio, saturação,
 * brilho, densidade de bordas]. Cada um entra com várias variações (jitter)
 * para o k-NN ter vizinhos suficientes e robustos desde o início. */
const CATEGORY_CENTROIDS: [string, number, number, number, number][] = [
  ['camisetas', 1.05, 0.42, 0.55, 0.14],
  ['camisas', 1.12, 0.32, 0.58, 0.26],
  ['moletons', 1.18, 0.26, 0.42, 0.18],
  ['jaquetas', 1.24, 0.28, 0.36, 0.34],
  ['calcas', 0.50, 0.28, 0.38, 0.19],
  ['shorts', 0.85, 0.36, 0.52, 0.13],
  ['saias', 0.68, 0.44, 0.52, 0.08],
  ['vestidos', 0.42, 0.48, 0.50, 0.14],
  ['ternos', 0.62, 0.10, 0.30, 0.24],
  ['sapatos', 1.55, 0.18, 0.34, 0.30],
  ['tenis', 1.78, 0.44, 0.54, 0.44],
  ['bones', 1.35, 0.38, 0.48, 0.19],
  ['acessorios', 0.98, 0.24, 0.58, 0.10],
];

function clamp01(n: number): number {
  return Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
}

/** Gera SAMPLES_PER_LABEL variações de uma categoria: perturbação pequena e
 * contínua em torno do centróide (mesma faixa de antes, só que com ruído
 * determinístico em vez de só 5 pontos fixos), mantendo o cluster coeso. */
function denseCategoryVariants(
  label: string,
  aspect: number,
  sat: number,
  bright: number,
  edge: number,
  seed: number
): [string, number, number, number, number][] {
  const rand = mulberry32(seed);
  const out: [string, number, number, number, number][] = [];
  for (let i = 0; i < SAMPLES_PER_LABEL; i++) {
    const j = () => (rand() - 0.5) * 0.06; // ±0.03, mesma amplitude do jitter manual anterior
    out.push([
      label,
      Math.round((aspect + j() * 2) * 1000) / 1000,
      clamp01(sat + j()),
      clamp01(bright + j()),
      clamp01(edge + j() / 2),
    ]);
  }
  return out;
}

export const SEED_CATEGORIES: [string, number, number, number, number][] = CATEGORY_CENTROIDS.flatMap(
  ([label, aspect, sat, bright, edge]) => denseCategoryVariants(label, aspect, sat, bright, edge, seedFromLabel(label))
);

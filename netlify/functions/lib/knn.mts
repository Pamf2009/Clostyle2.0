// Motor genérico de k-NN ponderado (k-vizinhos mais próximos), usado tanto
// pelo classificador de cor quanto pelo de categoria.
//
// É "aprendizado de máquina" no sentido literal e simples do termo: a
// "memória" do modelo é o próprio conjunto de exemplos gravados no banco.
// Cada correção que o usuário faz vira um novo exemplo (com peso maior que
// os exemplos semente), então a próxima classificação passa a considerar
// aquela correção — o modelo melhora sozinho a cada uso, sem precisar de
// retrain manual ou de infraestrutura de treinamento pesada.

export interface ClassificationResult {
  predicted: string;
  confidence: number; // 0..1, o quanto o vizinhos concordam com a predição
  needsReview: boolean; // IA não tem certeza -> pedir confirmação/correção
  alternatives: { label: string; score: number }[];
  neighborsUsed: number;
  trainingSetSize: number;
}

export interface KnnOptions {
  k?: number;
  /** confiança abaixo disso já pede revisão humana */
  reviewConfidenceThreshold?: number;
  /** se o 2º colocado chegar perto do 1º (razão), também pede revisão */
  closeCallRatioThreshold?: number;
}

const DEFAULTS: Required<KnnOptions> = {
  k: 9,
  reviewConfidenceThreshold: 0.55,
  closeCallRatioThreshold: 0.82,
};

export function weightedKnnClassify<T>(
  examples: T[],
  distanceFn: (example: T) => number,
  getLabel: (example: T) => string,
  getWeight: (example: T) => number,
  opts: KnnOptions = {}
): ClassificationResult {
  const { k, reviewConfidenceThreshold, closeCallRatioThreshold } = { ...DEFAULTS, ...opts };

  if (examples.length === 0) {
    return {
      predicted: "Desconhecida",
      confidence: 0,
      needsReview: true,
      alternatives: [],
      neighborsUsed: 0,
      trainingSetSize: 0,
    };
  }

  const ranked = examples
    .map((example) => ({ example, distance: Math.max(0, distanceFn(example)) }))
    .sort((a, b) => a.distance - b.distance);

  const neighbors = ranked.slice(0, Math.min(k, ranked.length));
  const EPS = 0.04;

  const scoreByLabel = new Map<string, number>();
  for (const { example, distance } of neighbors) {
    const label = getLabel(example);
    const weight = getWeight(example);
    // Peso inverso à distância: vizinhos mais próximos e exemplos com mais
    // "confiança" (peso, ex.: correções do usuário) pesam mais na votação.
    const contribution = weight / (EPS + distance);
    scoreByLabel.set(label, (scoreByLabel.get(label) ?? 0) + contribution);
  }

  const totalScore = Array.from(scoreByLabel.values()).reduce((a, b) => a + b, 0);
  const sortedLabels = Array.from(scoreByLabel.entries())
    .map(([label, score]) => ({ label, score: totalScore > 0 ? score / totalScore : 0 }))
    .sort((a, b) => b.score - a.score);

  const top = sortedLabels[0];
  const second = sortedLabels[1];
  const closeCall = second ? second.score / top.score > closeCallRatioThreshold : false;
  const needsReview = top.score < reviewConfidenceThreshold || closeCall;

  return {
    predicted: top.label,
    confidence: round(top.score),
    needsReview,
    alternatives: sortedLabels.slice(0, 4).map((l) => ({ label: l.label, score: round(l.score) })),
    neighborsUsed: neighbors.length,
    trainingSetSize: examples.length,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

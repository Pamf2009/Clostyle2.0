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
  /**
   * Distância (na escala do próprio distanceFn) do vizinho mais próximo
   * acima da qual, mesmo que os vizinhos concordem entre si, a predição é
   * tratada como incerta. Existe porque "confiança" pura (o quanto os
   * vizinhos concordam) e "familiaridade" (o quão perto o pior caso está de
   * QUALQUER exemplo já visto) são coisas diferentes: com uma base semente
   * densa (muitos exemplos por classe), é comum um ponto de fronteira ter
   * k vizinhos todos da MESMA classe vizinha só por ela ser a mais próxima
   * dentre as classes distantes — mesmo que na verdade nenhum exemplo do
   * treino pareça de verdade com a leitura. Sem esse teto, a IA fica
   * "confiante" por acaso, quando o certo é admitir que não reconhece a cor.
   * Sem valor definido, esse teto fica desligado (Infinity).
   */
  maxNeighborDistance?: number;
}

const DEFAULTS: Required<KnnOptions> = {
  k: 9,
  reviewConfidenceThreshold: 0.55,
  closeCallRatioThreshold: 0.82,
  maxNeighborDistance: Infinity,
};

export function weightedKnnClassify<T>(
  examples: T[],
  distanceFn: (example: T) => number,
  getLabel: (example: T) => string,
  getWeight: (example: T) => number,
  opts: KnnOptions = {}
): ClassificationResult {
  const { k, reviewConfidenceThreshold, closeCallRatioThreshold, maxNeighborDistance } = { ...DEFAULTS, ...opts };

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
  // "Familiaridade": mesmo com 100% de concordância entre os vizinhos, se o
  // mais próximo deles ainda está longe (nada no treino parece de verdade
  // com essa leitura), a predição é um "menos pior entre os distantes", não
  // um reconhecimento de verdade — ver comentário de maxNeighborDistance.
  const tooFarFromAnything = neighbors[0].distance > maxNeighborDistance;
  const needsReview = top.score < reviewConfidenceThreshold || closeCall || tooFarFromAnything;

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

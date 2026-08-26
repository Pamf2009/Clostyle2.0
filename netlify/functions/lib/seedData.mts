// Dados semente do motor de IA: usados para popular as bases de treinamento
// de cor e categoria na primeira leitura (quando o Netlify Blob store ainda
// está vazio), para o modelo já responder algo sensato antes de qualquer
// scan real do usuário. Depois disso, quem faz a base crescer é o próprio
// uso do app (ver colorModel.mts / categoryModel.mts).

/** Paleta semente: [rótulo em português, r, g, b]. Várias variações por
 * família de cor, para o k-NN ter vizinhos suficientes desde o início. */
export const SEED_COLORS: [string, number, number, number][] = [
  // Preto / Cinza / Branco
  ['Preto', 10, 10, 12], ['Preto', 25, 25, 28], ['Preto', 0, 0, 0],
  ['Cinza Chumbo', 55, 58, 63], ['Cinza', 107, 114, 128], ['Cinza Claro', 156, 163, 175],
  ['Grafite', 41, 45, 51],
  ['Branco', 255, 255, 255], ['Branco', 245, 245, 245], ['Off-White', 240, 236, 225],

  // Azuis
  ['Azul Marinho', 20, 32, 74], ['Azul Marinho', 30, 45, 90],
  ['Azul Royal', 37, 60, 199], ['Azul', 59, 130, 246], ['Azul', 40, 100, 220],
  ['Azul Claro', 147, 197, 253], ['Azul Bebê', 191, 219, 254],
  ['Azul Petróleo', 20, 80, 90], ['Ciano', 34, 197, 210],
  ['Índigo', 63, 55, 201],

  // Verdes
  ['Verde Militar', 74, 88, 45], ['Verde Musgo', 85, 99, 60],
  ['Verde', 16, 185, 129], ['Verde', 34, 150, 80], ['Verde Escuro', 20, 90, 50],
  ['Verde Limão', 163, 230, 53], ['Verde Água', 45, 212, 191],
  ['Verde Oliva', 107, 114, 60],

  // Vermelhos / Rosas
  ['Vermelho', 239, 68, 68], ['Vermelho', 200, 30, 30], ['Vermelho Escuro', 127, 29, 29],
  ['Bordô', 100, 20, 35], ['Vinho', 90, 20, 40],
  ['Rosa', 236, 72, 153], ['Rosa Claro', 249, 168, 212], ['Rosa Choque', 255, 20, 147],
  ['Salmão', 250, 128, 114],
  ['Coral', 255, 127, 80],

  // Laranja / Amarelo / Marrom / Bege
  ['Laranja', 249, 115, 22], ['Laranja Queimado', 194, 65, 12],
  ['Amarelo', 234, 179, 8], ['Amarelo', 250, 204, 21], ['Amarelo Mostarda', 202, 138, 4],
  ['Marrom', 120, 53, 15], ['Marrom Café', 92, 51, 23], ['Caramelo', 180, 110, 60],
  ['Bege', 222, 202, 173], ['Nude', 224, 190, 160], ['Areia', 210, 180, 140],
  ['Caqui', 189, 183, 107],

  // Roxos
  ['Roxo', 168, 85, 247], ['Lilás', 196, 181, 253], ['Violeta', 124, 58, 237],

  // Metálicos / neutros usados em acessórios
  ['Dourado', 212, 175, 55], ['Prateado', 192, 192, 192],
];

/** Centróides heurísticos por categoria: [rótulo, aspectRatio, saturação,
 * brilho, densidade de bordas]. Cada um entra com 3 variações (jitter) para
 * o k-NN ter vizinhos suficientes desde o início. */
const CATEGORY_CENTROIDS: [string, number, number, number, number][] = [
  ['camisetas', 1.05, 0.40, 0.55, 0.15],
  ['camisas', 1.10, 0.35, 0.55, 0.25],
  ['moletons', 1.15, 0.30, 0.45, 0.20],
  ['jaquetas', 1.20, 0.30, 0.40, 0.30],
  ['calcas', 0.55, 0.30, 0.40, 0.20],
  ['shorts', 0.80, 0.35, 0.50, 0.15],
  ['saias', 0.75, 0.40, 0.50, 0.10],
  ['vestidos', 0.50, 0.45, 0.50, 0.15],
  ['ternos', 0.60, 0.15, 0.35, 0.25],
  ['sapatos', 1.60, 0.25, 0.40, 0.35],
  ['tenis', 1.70, 0.40, 0.50, 0.40],
  ['bones', 1.30, 0.35, 0.45, 0.20],
  ['acessorios', 1.00, 0.30, 0.50, 0.15],
];

function clamp01(n: number): number {
  return Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
}

export const SEED_CATEGORIES: [string, number, number, number, number][] = CATEGORY_CENTROIDS.flatMap(
  ([label, aspect, sat, bright, edge]) =>
    [-0.06, 0, 0.06].map(
      (j): [string, number, number, number, number] => [
        label,
        Math.round((aspect + j) * 1000) / 1000,
        clamp01(sat + j / 2),
        clamp01(bright + j / 2),
        clamp01(edge + j / 3),
      ]
    )
);

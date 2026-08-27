// Dados semente do motor de IA: usados para popular as bases de treinamento
// de cor e categoria na primeira leitura (quando o Netlify Blob store ainda
// está vazio) e para ENRIQUECER stores que já existem (ver SEED_VERSION nos
// modelos), para o modelo já responder algo sensato antes de qualquer scan
// real do usuário. Depois disso, quem faz a base crescer é o próprio uso do
// app (ver colorModel.mts / categoryModel.mts).

/** Versão da paleta semente. Bump sempre que SEED_COLORS ou SEED_CATEGORIES
 * crescer/mudar de forma significativa — os modelos usam isso pra saber
 * quando precisam "regar" um store que já existia com os exemplos novos,
 * sem duplicar o que já está lá nem tocar em exemplos de user_feedback. */
export const SEED_VERSION = 2;

/** Paleta semente: [rótulo em português, r, g, b]. Várias variações de
 * luminosidade/saturação por família de cor, para o k-NN ter vizinhos
 * suficientes e robustos desde o início — inclusive sob luz ruim. */
export const SEED_COLORS: [string, number, number, number][] = [
  // ===== Preto / Cinza / Branco =====
  ['Preto', 0, 0, 0], ['Preto', 10, 10, 12], ['Preto', 18, 18, 20], ['Preto', 25, 25, 28],
  ['Grafite', 35, 38, 43], ['Grafite', 41, 45, 51], ['Grafite', 48, 52, 58],
  ['Cinza Chumbo', 55, 58, 63], ['Cinza Chumbo', 66, 69, 75],
  ['Cinza Escuro', 75, 78, 84], ['Cinza', 90, 96, 106], ['Cinza', 107, 114, 128], ['Cinza', 120, 126, 138],
  ['Cinza Claro', 145, 151, 161], ['Cinza Claro', 156, 163, 175], ['Cinza Claro', 178, 184, 194],
  ['Cinza Perola', 205, 209, 214],
  ['Off-White', 232, 228, 218], ['Off-White', 240, 236, 225],
  ['Branco', 245, 245, 245], ['Branco', 250, 250, 250], ['Branco', 255, 255, 255],

  // ===== Azuis =====
  ['Azul Marinho', 14, 24, 58], ['Azul Marinho', 20, 32, 74], ['Azul Marinho', 30, 45, 90], ['Azul Marinho', 38, 55, 105],
  ['Azul Petróleo', 15, 65, 75], ['Azul Petróleo', 20, 80, 90], ['Azul Petróleo', 28, 95, 105],
  ['Índigo', 55, 48, 180], ['Índigo', 63, 55, 201], ['Índigo', 78, 70, 220],
  ['Azul Royal', 30, 50, 175], ['Azul Royal', 37, 60, 199], ['Azul Royal', 48, 75, 215],
  ['Azul', 35, 90, 200], ['Azul', 40, 100, 220], ['Azul', 59, 130, 246], ['Azul', 75, 145, 250],
  ['Azul Cobalto', 25, 75, 190],
  ['Azul Claro', 120, 175, 245], ['Azul Claro', 147, 197, 253], ['Azul Claro', 170, 210, 253],
  ['Azul Bebê', 191, 219, 254], ['Azul Bebê', 210, 230, 255],
  ['Ciano', 25, 175, 190], ['Ciano', 34, 197, 210], ['Ciano', 55, 210, 222],
  ['Azul Jeans', 65, 105, 155], ['Azul Jeans', 85, 125, 170],
  ['Azul Acinzentado', 95, 115, 140],

  // ===== Verdes =====
  ['Verde Militar', 62, 74, 38], ['Verde Militar', 74, 88, 45], ['Verde Militar', 86, 100, 55],
  ['Verde Musgo', 72, 85, 50], ['Verde Musgo', 85, 99, 60], ['Verde Musgo', 98, 112, 70],
  ['Verde Escuro', 15, 75, 42], ['Verde Escuro', 20, 90, 50], ['Verde Escuro', 28, 105, 60],
  ['Verde', 16, 160, 110], ['Verde', 16, 185, 129], ['Verde', 34, 150, 80], ['Verde', 45, 200, 140],
  ['Verde Esmeralda', 20, 170, 100],
  ['Verde Oliva', 95, 100, 50], ['Verde Oliva', 107, 114, 60], ['Verde Oliva', 120, 128, 72],
  ['Verde Água', 40, 195, 175], ['Verde Água', 45, 212, 191], ['Verde Água', 65, 220, 200],
  ['Verde Limão', 150, 220, 45], ['Verde Limão', 163, 230, 53], ['Verde Limão', 180, 235, 80],
  ['Verde Menta', 150, 230, 195], ['Verde Menta', 170, 240, 210],
  ['Verde Sálvia', 140, 160, 130],

  // ===== Vermelhos / Rosas =====
  ['Vermelho Escuro', 110, 25, 25], ['Vermelho Escuro', 127, 29, 29], ['Vermelho Escuro', 145, 35, 35],
  ['Bordô', 85, 15, 30], ['Bordô', 100, 20, 35], ['Bordô', 115, 28, 42],
  ['Vinho', 75, 15, 35], ['Vinho', 90, 20, 40], ['Vinho', 105, 28, 48],
  ['Vermelho', 200, 30, 30], ['Vermelho', 220, 45, 45], ['Vermelho', 239, 68, 68], ['Vermelho', 245, 85, 85],
  ['Vermelho Tomate', 225, 60, 45],
  ['Rosa Choque', 255, 20, 147], ['Rosa Choque', 255, 45, 160],
  ['Rosa', 220, 60, 140], ['Rosa', 236, 72, 153], ['Rosa', 245, 100, 170],
  ['Rosa Claro', 249, 168, 212], ['Rosa Claro', 252, 190, 220],
  ['Rosa Antigo', 200, 145, 150],
  ['Salmão', 240, 115, 100], ['Salmão', 250, 128, 114], ['Salmão', 253, 145, 130],
  ['Coral', 245, 115, 70], ['Coral', 255, 127, 80], ['Coral', 255, 145, 105],

  // ===== Laranjas / Amarelos =====
  ['Laranja Queimado', 180, 60, 10], ['Laranja Queimado', 194, 65, 12], ['Laranja Queimado', 210, 78, 20],
  ['Laranja', 235, 105, 15], ['Laranja', 249, 115, 22], ['Laranja', 253, 135, 45],
  ['Pêssego', 250, 180, 140], ['Pêssego', 253, 200, 165],
  ['Amarelo Mostarda', 185, 128, 4], ['Amarelo Mostarda', 202, 138, 4], ['Amarelo Mostarda', 218, 155, 20],
  ['Amarelo Ouro', 220, 165, 10],
  ['Amarelo', 220, 165, 8], ['Amarelo', 234, 179, 8], ['Amarelo', 250, 204, 21], ['Amarelo', 253, 224, 71],
  ['Amarelo Claro', 253, 235, 130],
  ['Creme', 245, 230, 190], ['Creme', 250, 240, 210],

  // ===== Marrons / Bege / Terrosos =====
  ['Marrom', 105, 45, 12], ['Marrom', 120, 53, 15], ['Marrom', 135, 65, 25],
  ['Marrom Café', 78, 43, 18], ['Marrom Café', 92, 51, 23], ['Marrom Café', 105, 60, 30],
  ['Caramelo', 165, 100, 50], ['Caramelo', 180, 110, 60], ['Caramelo', 195, 125, 75],
  ['Terracota', 190, 90, 55], ['Terracota', 205, 105, 68],
  ['Tabaco', 130, 90, 55],
  ['Areia', 195, 165, 125], ['Areia', 210, 180, 140], ['Areia', 222, 195, 158],
  ['Caqui', 175, 168, 95], ['Caqui', 189, 183, 107], ['Caqui', 200, 195, 125],
  ['Bege', 210, 190, 158], ['Bege', 222, 202, 173], ['Bege', 232, 214, 188],
  ['Nude', 210, 175, 145], ['Nude', 224, 190, 160], ['Nude', 235, 205, 178],

  // ===== Roxos =====
  ['Violeta', 108, 45, 220], ['Violeta', 124, 58, 237], ['Violeta', 140, 75, 245],
  ['Roxo', 150, 65, 235], ['Roxo', 168, 85, 247], ['Roxo', 185, 105, 250],
  ['Lilás', 185, 168, 250], ['Lilás', 196, 181, 253], ['Lilás', 210, 198, 254],
  ['Ameixa', 90, 45, 90], ['Ameixa', 105, 55, 105],
  ['Lavanda', 200, 190, 235], ['Lavanda', 215, 205, 245],
  ['Magenta', 200, 30, 180], ['Magenta', 220, 50, 200],

  // ===== Metálicos / neutros de acessórios =====
  ['Dourado', 195, 160, 45], ['Dourado', 212, 175, 55], ['Dourado', 225, 190, 80],
  ['Prateado', 175, 175, 175], ['Prateado', 192, 192, 192], ['Prateado', 210, 210, 212],
  ['Bronze', 140, 100, 55], ['Cobre', 175, 100, 65],
];

/** Centróides heurísticos por categoria: [rótulo, aspectRatio, saturação,
 * brilho, densidade de bordas]. Cada um entra com várias variações (jitter)
 * para o k-NN ter vizinhos suficientes e robustos desde o início. */
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

// Mais pontos de jitter (7 em vez de 3) por categoria: com mais variação em
// torno de cada centróide, o k-NN fica menos sensível a uma única foto fora
// da curva e cobre melhor peças de cores/texturas variadas dentro da mesma
// categoria.
const JITTER_STEPS = [-0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12];

export const SEED_CATEGORIES: [string, number, number, number, number][] = CATEGORY_CENTROIDS.flatMap(
  ([label, aspect, sat, bright, edge]) =>
    JITTER_STEPS.map(
      (j): [string, number, number, number, number] => [
        label,
        Math.round((aspect + j) * 1000) / 1000,
        clamp01(sat + j / 2),
        clamp01(bright + j / 2),
        clamp01(edge + j / 3),
      ]
    )
);

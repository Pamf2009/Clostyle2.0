// Gera o SQL de seed (semente) para color_training_examples a partir de uma
// paleta de referência RGB -> nome em português. Rode com:
//   node scripts/gen-color-seed-sql.mjs > netlify/database/migrations/.../migration.sql
// Mantido no repo para facilitar ampliar a paleta semente no futuro.

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = 60 * (((g - b) / d) % 6); break;
      case g: h = 60 * ((b - r) / d + 2); break;
      case b: h = 60 * ((r - g) / d + 4); break;
    }
  }
  if (h < 0) h += 360;
  return { h: round(h), s: round(s), l: round(l) };
}
function round(n) { return Math.round(n * 1000) / 1000; }

// Paleta semente: várias variações por família de cor, para o k-NN ter
// vizinhos suficientes mesmo antes de qualquer correção do usuário.
export const SEED_PALETTE = [
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

// Só imprime o SQL quando o arquivo é executado diretamente (`node
// scripts/gen-color-seed-sql.mjs`), não quando outro módulo importa
// SEED_PALETTE/rgbToHsl para testes.
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const rows = SEED_PALETTE.map(([label, r, g, b]) => {
    const { h, s, l } = rgbToHsl(r, g, b);
    return `(${r}, ${g}, ${b}, ${h}, ${s}, ${l}, '${label.replace(/'/g, "''")}', 'seed', 1)`;
  });

  console.log(`-- Gerado por scripts/gen-color-seed-sql.mjs — NÃO editar campos h/s/l manualmente.\n`);
  console.log(`INSERT INTO color_training_examples (r, g, b, h, s, l, label, source, weight) VALUES`);
  console.log(rows.join(',\n') + ';');
}

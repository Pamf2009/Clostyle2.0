// Gera o SQL de seed para category_training_examples: centróides heurísticos
// (proporção largura/altura do enquadramento, saturação/brilho médios e
// densidade de bordas) por categoria de peça, com pequenas variações para o
// k-NN ter vizinhos suficientes antes de qualquer correção do usuário.
// Rode com: node scripts/gen-category-seed-sql.mjs > .../migration.sql

const CENTROIDS = [
  // label,        aspect, sat,  bright, edge
  ['camisetas', 1.05, 0.40, 0.55, 0.15],
  ['camisas',   1.10, 0.35, 0.55, 0.25],
  ['moletons',  1.15, 0.30, 0.45, 0.20],
  ['jaquetas',  1.20, 0.30, 0.40, 0.30],
  ['calcas',    0.55, 0.30, 0.40, 0.20],
  ['shorts',    0.80, 0.35, 0.50, 0.15],
  ['saias',     0.75, 0.40, 0.50, 0.10],
  ['vestidos',  0.50, 0.45, 0.50, 0.15],
  ['ternos',    0.60, 0.15, 0.35, 0.25],
  ['sapatos',   1.60, 0.25, 0.40, 0.35],
  ['tenis',     1.70, 0.40, 0.50, 0.40],
  ['bones',     1.30, 0.35, 0.45, 0.20],
  ['acessorios',1.00, 0.30, 0.50, 0.15],
];

const JITTER = [-0.06, 0, 0.06];

const rows = [];
for (const [label, aspect, sat, bright, edge] of CENTROIDS) {
  JITTER.forEach((j) => {
    const clamp01 = (n) => Math.min(1, Math.max(0, +n.toFixed(3)));
    rows.push(
      `(${(aspect + j).toFixed(3)}, ${clamp01(sat + j / 2)}, ${clamp01(bright + j / 2)}, ${clamp01(edge + j / 3)}, 0, '${label}', 'seed', 1)`
    );
  });
}

console.log(`-- Gerado por scripts/gen-category-seed-sql.mjs — centróides heurísticos iniciais.\n`);
console.log(`INSERT INTO category_training_examples (aspect_ratio, avg_saturation, avg_brightness, edge_density, hue, label, source, weight) VALUES`);
console.log(rows.join(',\n') + ';');

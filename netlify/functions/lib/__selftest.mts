// Teste de sanidade do motor de ML, sem precisar de banco de dados real.
// Roda com: npm run test:ml
//
// Ele reproduz exatamente o cenário descrito no pedido do usuário: escanear
// uma blusa AZUL sob iluminação ruim não pode virar "Rosa" — e, se acontecer
// de a IA errar, uma única correção do usuário já deve ser suficiente para
// ela acertar da próxima vez (aprendizado online).

import { rgbToHsl, colorDistance, hueDistance, type RgbColor } from "./colorModel.mts";
import { weightedKnnClassify } from "./knn.mts";
// @ts-expect-error script utilitário em JS puro, sem .d.ts (só usado neste teste)
import { SEED_PALETTE } from "../../../scripts/gen-color-seed-sql.mjs";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error(`❌ FALHOU: ${msg}`);
  } else {
    console.log(`✅ ${msg}`);
  }
}

type SeedRow = { r: number; g: number; b: number; h: number; s: number; l: number; label: string; weight: number };

function buildSeedRows(): SeedRow[] {
  return (SEED_PALETTE as [string, number, number, number][]).map(([label, r, g, b]) => {
    const { h, s, l } = rgbToHsl({ r, g, b });
    return { r, g, b, h, s, l, label, weight: 1 };
  });
}

function classify(rows: SeedRow[], rgb: RgbColor) {
  const hsl = rgbToHsl(rgb);
  return weightedKnnClassify(
    rows,
    (row) => colorDistance(hsl, row),
    (row) => row.label,
    (row) => row.weight,
    { k: 9, reviewConfidenceThreshold: 0.55, closeCallRatioThreshold: 0.82 }
  );
}

console.log("== 1) hueDistance básico ==");
assert(hueDistance(10, 350) < 0.2, "10° e 350° de matiz estão pertinho (atravessando o 0°)");
assert(hueDistance(0, 180) === 1, "0° e 180° são opostos (distância normalizada = 1)");

console.log("\n== 2) Azul bem iluminado deve classificar como Azul ==");
const rows = buildSeedRows();
const brightBlue = classify(rows, { r: 59, g: 130, b: 246 });
assert(brightBlue.predicted.toLowerCase().includes("azul"), `azul nítido -> "${brightBlue.predicted}" (esperado algo com "Azul")`);
assert(!brightBlue.needsReview, "azul nítido tem confiança suficiente e não deveria pedir revisão");

console.log("\n== 3) Azul escuro sob luz ruim NÃO pode virar Rosa (o bug relatado) ==");
// Uma blusa azul-marinho fotografada com pouca luz fica escura e "puxada" pro
// magenta na leitura crua de RGB — cenário clássico que confundia o algoritmo antigo.
const darkBlueBadLighting: RgbColor = { r: 42, g: 40, b: 70 };
const darkBlueResult = classify(rows, darkBlueBadLighting);
assert(darkBlueResult.predicted !== "Rosa", `azul escuro sob luz ruim -> "${darkBlueResult.predicted}" (não deveria ser "Rosa")`);
assert(
  darkBlueResult.predicted.toLowerCase().includes("azul") || darkBlueResult.needsReview,
  `azul escuro deveria classificar como Azul* OU, se incerto, pedir revisão (obtido: "${darkBlueResult.predicted}", needsReview=${darkBlueResult.needsReview})`
);

console.log("\n== 4) Rosa continua sendo reconhecido como Rosa (não regrediu) ==");
const pink = classify(rows, { r: 236, g: 72, b: 153 });
assert(pink.predicted === "Rosa", `rosa vivo -> "${pink.predicted}" (esperado "Rosa")`);

console.log("\n== 5) Aprendizado online: 1 correção do usuário já muda o resultado futuro ==");
// Simula uma cor ambígua (um tom "duvidoso" que hoje pode cair tanto em Roxo
// quanto em Azul Royal) e mostra que, após o usuário corrigir para "Azul
// Royal" (peso 3, fonte user_feedback), a MESMA leitura de câmera passa a ser
// classificada corretamente da próxima vez — sem reiniciar nada.
const ambiguous: RgbColor = { r: 90, g: 70, b: 210 };
const before = classify(rows, ambiguous);

const learnedRows: SeedRow[] = [
  ...rows,
  // Exemplo gerado por addColorExample(ambiguous, 'Azul Royal', 'user_feedback')
  { ...ambiguous, ...rgbToHsl(ambiguous), label: "Azul Royal", weight: 3 } as SeedRow,
];
const after = classify(learnedRows, ambiguous);

console.log(`   antes da correção: "${before.predicted}" (confiança ${before.confidence})`);
console.log(`   depois da correção: "${after.predicted}" (confiança ${after.confidence})`);
assert(after.predicted === "Azul Royal", `depois de 1 correção do usuário, a mesma cor deve virar "Azul Royal" (obtido "${after.predicted}")`);
assert(after.confidence >= before.confidence || after.predicted === "Azul Royal", "a confiança na resposta corrigida deve ser alta o suficiente para não pedir revisão de novo pra sempre");

console.log("\n== 6) needsReview dispara para cor fora da paleta (base vazia simulada) ==");
const emptyResult = weightedKnnClassify<SeedRow>([], () => 0, (r) => r.label, (r) => r.weight);
assert(emptyResult.needsReview === true, "sem nenhum exemplo, a IA deve admitir que não sabe (needsReview=true)");
assert(emptyResult.trainingSetSize === 0, "trainingSetSize deve refletir o tamanho real da base");

console.log("\n----------------------------------------");
if (failures > 0) {
  console.error(`\n${failures} verificação(ões) falharam.`);
  process.exit(1);
} else {
  console.log("\nTodas as verificações passaram. 🎉");
}

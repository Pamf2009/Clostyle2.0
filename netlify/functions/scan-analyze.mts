// POST /api/scan/analyze
// Recebe as características extraídas da imagem (no navegador, via canvas) e
// devolve a predição de COR e CATEGORIA da peça, com nível de confiança.
// Quando a confiança é baixa, `needsReview` vem true e o front mostra a
// sugestão junto com alternativas para o usuário decidir/corrigir.
import type { Config } from "@netlify/functions";
import { badRequest, json, serverError } from "./lib/http.mts";
import { classifyColor, type RgbColor } from "./lib/colorModel.mts";
import { classifyCategory, type CategoryFeatures } from "./lib/categoryModel.mts";

interface AnalyzeBody {
  rgb: RgbColor;
  category?: CategoryFeatures;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return badRequest("Use POST");
  }

  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return badRequest("JSON inválido");
  }

  const { rgb, category } = body || {};
  if (!rgb || [rgb.r, rgb.g, rgb.b].some((n) => typeof n !== "number" || Number.isNaN(n))) {
    return badRequest("Campo 'rgb' inválido (esperado {r,g,b})");
  }

  try {
    const colorResult = await classifyColor(rgb);
    const categoryResult = category ? await classifyCategory(category) : null;

    return json({
      color: colorResult,
      category: categoryResult,
    });
  } catch (err) {
    return serverError(err);
  }
};

export const config: Config = {
  path: "/api/scan/analyze",
};

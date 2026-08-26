// POST /api/scan/feedback
// Aqui é onde a IA efetivamente "aprende sozinha": o front chama esta rota
// toda vez que o usuário confirma (ou corrige) a cor/categoria sugerida pelo
// scanner. Cada confirmação vira um novo exemplo de treinamento com peso
// maior que a base semente (é dado real do usuário, na câmera/luz dele), e
// fica disponível para a PRÓXIMA classificação imediatamente — sem re-treino
// manual, sem deploy, sem esperar um processo em lote.
import type { Config } from "@netlify/functions";
import { badRequest, json, serverError } from "./lib/http.mts";
import { addColorExample, type RgbColor } from "./lib/colorModel.mts";
import { addCategoryExample, type CategoryFeatures } from "./lib/categoryModel.mts";
import { appendScanEvent } from "./lib/scanEvents.mts";

interface FeedbackBody {
  rgb?: RgbColor;
  categoryFeatures?: CategoryFeatures;
  predictedColor?: string;
  finalColor?: string;
  colorConfidence?: number;
  colorNeededReview?: boolean;
  predictedCategory?: string;
  finalCategory?: string;
  categoryConfidence?: number;
  categoryNeededReview?: boolean;
  itemId?: string | null;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return badRequest("Use POST");
  }

  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return badRequest("JSON inválido");
  }

  const {
    rgb,
    categoryFeatures,
    predictedColor = null,
    finalColor = null,
    colorConfidence = null,
    colorNeededReview = false,
    predictedCategory = null,
    finalCategory = null,
    categoryConfidence = null,
    categoryNeededReview = false,
    itemId = null,
  } = body || {};

  if (!rgb && !categoryFeatures) {
    return badRequest("Envie ao menos 'rgb' ou 'categoryFeatures'");
  }

  try {
    let colorLearned = false;
    let categoryLearned = false;

    // O usuário confirmou/corrigiu uma cor final -> vira exemplo de verdade
    // (mesmo quando finalColor === predictedColor: é uma confirmação real,
    // reforça que a IA acertou naquelas condições de luz/câmera).
    if (rgb && finalColor) {
      await addColorExample(rgb, finalColor, "user_feedback", itemId);
      colorLearned = true;
    }
    if (categoryFeatures && finalCategory) {
      await addCategoryExample(categoryFeatures, finalCategory, "user_feedback", itemId);
      categoryLearned = true;
    }

    await appendScanEvent({
      itemId,
      predictedColor,
      colorConfidence,
      colorNeededReview,
      correctedColor: finalColor,
      predictedCategory,
      categoryConfidence,
      categoryNeededReview,
      correctedCategory: finalCategory,
    });

    const colorWasCorrection = Boolean(predictedColor && finalColor && predictedColor !== finalColor);
    const categoryWasCorrection = Boolean(predictedCategory && finalCategory && predictedCategory !== finalCategory);

    return json({
      ok: true,
      colorLearned,
      categoryLearned,
      colorWasCorrection,
      categoryWasCorrection,
      message: buildMessage(colorWasCorrection, categoryWasCorrection, colorLearned, categoryLearned),
    });
  } catch (err) {
    return serverError(err);
  }
};

function buildMessage(colorCorrected: boolean, categoryCorrected: boolean, colorLearned: boolean, categoryLearned: boolean): string {
  if (colorCorrected && categoryCorrected) return "Obrigado! A IA aprendeu com as duas correções (cor e categoria) e vai acertar mais da próxima vez.";
  if (colorCorrected) return "Obrigado pela correção! A IA já registrou o novo exemplo de cor e vai considerá-lo nos próximos escaneamentos.";
  if (categoryCorrected) return "Obrigado pela correção! A IA já registrou o novo exemplo de categoria.";
  if (colorLearned || categoryLearned) return "Confirmação registrada — isso reforça o que a IA já sabe.";
  return "Nada para aprender neste envio.";
}

export const config: Config = {
  path: "/api/scan/feedback",
};

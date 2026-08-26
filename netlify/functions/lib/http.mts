// Pequeno helper de resposta JSON compartilhado pelas funções.
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

export function notFound(message = "Não encontrado"): Response {
  return json({ error: message }, 404);
}

export function serverError(err: unknown): Response {
  console.error(err);
  const message = err instanceof Error ? err.message : "Erro interno";
  return json({ error: message }, 500);
}

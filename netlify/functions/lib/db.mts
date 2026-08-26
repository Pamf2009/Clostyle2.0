// Camada de acesso ao banco de dados (Netlify DB — Postgres provisionado
// automaticamente). Um único ponto de entrada para todas as funções.
import { getDatabase } from "@netlify/database";

let cached: ReturnType<typeof getDatabase> | null = null;

export function db() {
  if (!cached) {
    cached = getDatabase();
  }
  return cached;
}

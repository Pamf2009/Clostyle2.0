// "Diário de aprendizado" da IA: cada scan confirmado/corrigido pelo usuário
// vira uma entrada aqui — usado pelo painel "Motor de IA" para mostrar as
// últimas correções aprendidas.
import { getBlobStore } from "./blobStore.mts";

export interface ScanEvent {
  itemId: string | null;
  predictedColor: string | null;
  colorConfidence: number | null;
  colorNeededReview: boolean;
  correctedColor: string | null;
  predictedCategory: string | null;
  categoryConfidence: number | null;
  categoryNeededReview: boolean;
  correctedCategory: string | null;
  createdAt: string;
}

const STORE_NAME = "ml-scan-events";
const BLOB_KEY = "events";
const MAX_EVENTS = 500;

export async function appendScanEvent(event: Omit<ScanEvent, "createdAt">): Promise<void> {
  const store = getBlobStore(STORE_NAME);
  const existing = ((await store.get(BLOB_KEY, { type: "json" })) as ScanEvent[] | null) ?? [];
  existing.push({ ...event, createdAt: new Date().toISOString() });
  const trimmed = existing.length > MAX_EVENTS ? existing.slice(existing.length - MAX_EVENTS) : existing;
  await store.setJSON(BLOB_KEY, trimmed);
}

export async function getRecentScanEvents(limit = 15): Promise<ScanEvent[]> {
  const store = getBlobStore(STORE_NAME);
  const existing = ((await store.get(BLOB_KEY, { type: "json" })) as ScanEvent[] | null) ?? [];
  return existing.slice(-limit).reverse(); // mais recentes primeiro
}

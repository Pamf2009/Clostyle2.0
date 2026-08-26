// /api/wardrobe (GET, POST) e /api/wardrobe/:id (PUT, DELETE)
// Backup/sincronização em banco de dados real (Netlify Blobs) do guarda-roupa.
// O app continua funcionando 100% offline via localStorage (é a fonte
// primária de leitura da UI, para não quebrar nada em uso sem rede) — esta
// rota é uma cópia de segurança em nuvem gravada em paralelo a cada
// criação/edição/remoção.
import type { Config } from "@netlify/functions";
import { badRequest, json, notFound, serverError } from "./lib/http.mts";
import { getBlobStore } from "./lib/blobStore.mts";

interface WardrobeItem {
  id: string;
  name: string;
  category?: string | null;
  brand?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  size?: string | null;
  material?: string | null;
  photo?: string | null;
  usageCount?: number;
  features?: unknown;
  updatedAt?: string;
}

const STORE_NAME = "wardrobe";
const BLOB_KEY = "items";

async function loadItems(): Promise<WardrobeItem[]> {
  const store = getBlobStore(STORE_NAME);
  const existing = await store.get(BLOB_KEY, { type: "json" });
  return Array.isArray(existing) ? (existing as WardrobeItem[]) : [];
}

async function saveItems(items: WardrobeItem[]): Promise<void> {
  const store = getBlobStore(STORE_NAME);
  await store.setJSON(BLOB_KEY, items);
}

export default async (req: Request): Promise<Response> => {
  const pathname = new URL(req.url).pathname;
  const isCollectionRoute = pathname === "/api/wardrobe" || pathname === "/.netlify/functions/wardrobe";
  const idFromPath = isCollectionRoute ? null : decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
  const pathHasId = !isCollectionRoute && Boolean(idFromPath);

  try {
    if (req.method === "GET") {
      const items = await loadItems();
      items.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
      return json({ items });
    }

    if (req.method === "POST") {
      const body = (await req.json()) as WardrobeItem;
      if (!body?.id || !body?.name) return badRequest("Campos 'id' e 'name' são obrigatórios");

      const items = await loadItems();
      const idx = items.findIndex((i) => i.id === body.id);
      const record: WardrobeItem = { ...body, updatedAt: new Date().toISOString() };
      if (idx === -1) items.push(record);
      else items[idx] = record;

      await saveItems(items);
      return json({ ok: true, id: body.id });
    }

    if (req.method === "PUT" && pathHasId && idFromPath) {
      const body = (await req.json()) as Partial<WardrobeItem>;
      const items = await loadItems();
      const idx = items.findIndex((i) => i.id === idFromPath);
      if (idx === -1) return notFound("Peça não encontrada");

      items[idx] = { ...items[idx], ...body, id: idFromPath, updatedAt: new Date().toISOString() };
      await saveItems(items);
      return json({ ok: true, id: idFromPath });
    }

    if (req.method === "DELETE" && pathHasId && idFromPath) {
      const items = await loadItems();
      const filtered = items.filter((i) => i.id !== idFromPath);
      await saveItems(filtered);
      return json({ ok: true, id: idFromPath });
    }

    return notFound("Rota/método não suportado");
  } catch (err) {
    return serverError(err);
  }
};

export const config: Config = {
  path: ["/api/wardrobe", "/api/wardrobe/*"],
};

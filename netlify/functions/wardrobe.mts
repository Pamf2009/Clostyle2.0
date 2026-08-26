// /api/wardrobe (GET, POST) e /api/wardrobe/:id (PUT, DELETE)
// Backup/sincronização em banco de dados real (Postgres) do guarda-roupa.
// O app continua funcionando 100% offline via localStorage (é a fonte
// primária de leitura da UI, para não quebrar nada em uso sem rede) — esta
// rota é uma cópia de segurança em nuvem gravada em paralelo a cada
// criação/edição/remoção, e também guarda o vínculo com os exemplos de
// treinamento (item_id) gerados durante o escaneamento daquela peça.
import type { Config } from "@netlify/functions";
import { badRequest, json, notFound, serverError } from "./lib/http.mts";
import { db } from "./lib/db.mts";

interface WardrobeItemBody {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  primaryColor?: string;
  secondaryColor?: string;
  size?: string;
  material?: string;
  photo?: string;
  usageCount?: number;
  features?: unknown;
}

export default async (req: Request): Promise<Response> => {
  const database = db();
  const pathname = new URL(req.url).pathname;
  const isCollectionRoute = pathname === "/api/wardrobe" || pathname === "/.netlify/functions/wardrobe";
  const idFromPath = isCollectionRoute ? null : decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
  const pathHasId = !isCollectionRoute && Boolean(idFromPath);

  try {
    if (req.method === "GET") {
      const rows = await database.sql`SELECT * FROM wardrobe_items ORDER BY created_at DESC`;
      return json({ items: rows });
    }

    if (req.method === "POST") {
      const body = (await req.json()) as WardrobeItemBody;
      if (!body?.id || !body?.name) return badRequest("Campos 'id' e 'name' são obrigatórios");

      await database.sql`
        INSERT INTO wardrobe_items (id, name, category, brand, primary_color, secondary_color, size, material, photo, usage_count, features)
        VALUES (${body.id}, ${body.name}, ${body.category ?? null}, ${body.brand ?? null}, ${body.primaryColor ?? null},
                ${body.secondaryColor ?? null}, ${body.size ?? null}, ${body.material ?? null}, ${body.photo ?? null},
                ${body.usageCount ?? 0}, ${JSON.stringify(body.features ?? null)})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          brand = EXCLUDED.brand,
          primary_color = EXCLUDED.primary_color,
          secondary_color = EXCLUDED.secondary_color,
          size = EXCLUDED.size,
          material = EXCLUDED.material,
          photo = EXCLUDED.photo,
          usage_count = EXCLUDED.usage_count,
          features = EXCLUDED.features,
          updated_at = NOW()
      `;
      return json({ ok: true, id: body.id });
    }

    if (req.method === "PUT" && pathHasId && idFromPath) {
      const body = (await req.json()) as Partial<WardrobeItemBody>;
      await database.sql`
        UPDATE wardrobe_items SET
          name = COALESCE(${body.name ?? null}, name),
          category = COALESCE(${body.category ?? null}, category),
          brand = COALESCE(${body.brand ?? null}, brand),
          primary_color = COALESCE(${body.primaryColor ?? null}, primary_color),
          secondary_color = COALESCE(${body.secondaryColor ?? null}, secondary_color),
          size = COALESCE(${body.size ?? null}, size),
          material = COALESCE(${body.material ?? null}, material),
          photo = COALESCE(${body.photo ?? null}, photo),
          usage_count = COALESCE(${body.usageCount ?? null}, usage_count),
          updated_at = NOW()
        WHERE id = ${idFromPath}
      `;
      return json({ ok: true, id: idFromPath });
    }

    if (req.method === "DELETE" && pathHasId && idFromPath) {
      await database.sql`DELETE FROM wardrobe_items WHERE id = ${idFromPath}`;
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

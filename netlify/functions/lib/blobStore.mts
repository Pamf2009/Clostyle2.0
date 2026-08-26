// Camada de acesso ao banco de dados: Netlify Blobs.
//
// Por que Blobs e não Postgres? A extensão "Netlify DB" (que provisionava um
// Postgres via Neon automaticamente) foi descontinuada para criação de novos
// bancos — tentar usá-la quebra o deploy. Blobs é um armazenamento de
// objetos nativo da Netlify, sem nenhuma configuração ou extensão externa
// necessária, disponível em qualquer site/função.
//
// Deploy previews (como o gerado por este PR) usam um store por-deploy, para
// não misturar dados de teste com produção — o mesmo princípio de isolamento
// que um banco por-branch teria.
import { getStore, getDeployStore, type Store } from "@netlify/blobs";

export function getBlobStore(name: string): Store {
  const isProduction = typeof Netlify !== "undefined" && Netlify.context?.deploy?.context === "production";
  return isProduction ? getStore({ name, consistency: "strong" }) : getDeployStore({ name, consistency: "strong" });
}

-- CloStyle · Escaneamento de Roupas com IA
-- Esquema inicial: guarda-roupa + exemplos de treinamento (cor e categoria) + eventos de scan + métricas do modelo.
-- Esta migração roda automaticamente no primeiro deploy / `netlify dev` (Netlify Database provisiona o Postgres).

CREATE TABLE IF NOT EXISTS wardrobe_items (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT,
  brand           TEXT,
  primary_color   TEXT,
  secondary_color TEXT,
  size            TEXT,
  material        TEXT,
  photo           TEXT,
  usage_count     INTEGER NOT NULL DEFAULT 0,
  features        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exemplos de treinamento do classificador de COR.
-- source: 'seed' (base inicial cadastrada por nós) | 'user_feedback' (correção feita pelo usuário)
-- weight: exemplos corrigidos pelo próprio usuário pesam mais que a base semente,
--         pois refletem a câmera/iluminação reais do usuário.
CREATE TABLE IF NOT EXISTS color_training_examples (
  id          SERIAL PRIMARY KEY,
  r           SMALLINT NOT NULL,
  g           SMALLINT NOT NULL,
  b           SMALLINT NOT NULL,
  h           REAL NOT NULL,
  s           REAL NOT NULL,
  l           REAL NOT NULL,
  label       TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'seed',
  weight      REAL NOT NULL DEFAULT 1,
  item_id     TEXT REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_color_examples_label ON color_training_examples(label);

-- Exemplos de treinamento do classificador de CATEGORIA (camiseta, calça, tênis, etc.)
CREATE TABLE IF NOT EXISTS category_training_examples (
  id              SERIAL PRIMARY KEY,
  aspect_ratio    REAL NOT NULL,
  avg_saturation  REAL NOT NULL,
  avg_brightness  REAL NOT NULL,
  edge_density    REAL NOT NULL,
  hue             REAL NOT NULL,
  label           TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'seed',
  weight          REAL NOT NULL DEFAULT 1,
  item_id         TEXT REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_examples_label ON category_training_examples(label);

-- Toda vez que a câmera escaneia uma peça, gravamos o que a IA previu e o que
-- acabou sendo confirmado/corrigido. É o "diário de aprendizado" da IA.
CREATE TABLE IF NOT EXISTS scan_events (
  id                    SERIAL PRIMARY KEY,
  item_id               TEXT REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  predicted_color       TEXT,
  color_confidence      REAL,
  color_needed_review   BOOLEAN NOT NULL DEFAULT FALSE,
  corrected_color       TEXT,
  predicted_category    TEXT,
  category_confidence   REAL,
  category_needed_review BOOLEAN NOT NULL DEFAULT FALSE,
  corrected_category    TEXT,
  features              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_events_created_at ON scan_events(created_at DESC);

-- Snapshots de acurácia estimada ao longo do tempo, para mostrar a evolução do
-- aprendizado no painel "Motor de IA".
CREATE TABLE IF NOT EXISTS model_metrics (
  id              SERIAL PRIMARY KEY,
  model_name      TEXT NOT NULL,
  accuracy        REAL,
  total_examples  INTEGER,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_metrics_name_time ON model_metrics(model_name, computed_at DESC);

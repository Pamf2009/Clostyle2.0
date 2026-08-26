# Escaneamento de Roupas com IA — Banco de Dados + Machine Learning

Este documento descreve a nova arquitetura de escaneamento de roupas do CloStyle:
um banco de dados real (Postgres, provisionado automaticamente pela Netlify) e um
motor de Machine Learning que **aprende sozinho** a partir das correções feitas
pelo próprio usuário — exatamente o cenário descrito no pedido original: escanear
uma blusa azul, a IA errar dizendo "Rosa", e o app usar essa correção para acertar
da próxima vez.

## 1. Por que o scanner antigo errava a cor?

O código anterior:

1. Lia **1 único pixel médio** (uma amostra de 10×10 no centro da imagem).
2. Comparava esse pixel com **11 cores fixas**, usando distância euclidiana em
   **RGB puro**.

RGB puro é dominado pela luminosidade. Sob luz ruim, um azul-marinho escuro pode
ficar numericamente mais "perto" de um rosa escuro do que de um azul claro — mesmo
tendo matiz (a cor em si) completamente diferente. Não havia banco de dados, não
havia memória de nada, e a "IA" de categoria/marca/material era, na real, um texto
fixo (`'camisetas'`, `'Nike'`, ...) — nunca vinha da imagem.

## 2. Arquitetura nova

```
Câmera (navegador)
   │  extrai features reais da imagem (canvas)
   ▼
netlify/functions/scan-analyze.mts  ──┐
netlify/functions/scan-feedback.mts ──┼── netlify/functions/lib/{colorModel,categoryModel,knn}.mts
netlify/functions/ml-stats.mts      ──┤
netlify/functions/wardrobe.mts      ──┘
   │
   ▼
Netlify DB (Postgres, auto-provisionado) — netlify/database/migrations/
```

- **Banco de dados**: [`@netlify/database`](https://docs.netlify.com/) — um Postgres
  é provisionado automaticamente no primeiro deploy (ou `netlify dev`), sem
  necessidade de criar/configurar nada manualmente nem guardar connection string.
- **Funções serverless**: 4 rotas HTTP (`/api/wardrobe`, `/api/scan/analyze`,
  `/api/scan/feedback`, `/api/ml/stats`) em `netlify/functions/*.mts`.
- **Migrações**: `netlify/database/migrations/` — rodam automaticamente a cada
  deploy. A primeira cria o esquema; as duas seguintes populam uma paleta semente
  de ~50 cores e ~39 exemplos de categoria (heurísticos), para o modelo já
  responder algo sensato antes de qualquer uso real.

## 3. O modelo de Machine Learning

Não é uma rede neural pesada (não há dataset de milhões de fotos disponível aqui) —
é **k-NN ponderado** (`netlify/functions/lib/knn.mts`), que é honestamente o que
"aprender com exemplos" significa em ML: a "memória" do modelo *é* o próprio banco
de exemplos, e cada correção do usuário vira um exemplo novo, imediatamente
disponível na próxima classificação — sem re-treino manual, sem job em lote, sem
deploy.

### Cor

- A cor é convertida de RGB para HSL, e a distância entre duas cores dá **peso
  muito maior à diferença de matiz (hue)** do que a brilho/saturação — é assim que
  o olho humano distingue "isso é azul" de "isso é rosa", diferente da distância
  euclidiana crua em RGB que causava o bug relatado.
- k-NN com k=9, pesos inversamente proporcionais à distância.
- Exemplos com `source = 'user_feedback'` (correções reais do usuário) pesam 3×
  mais que a base semente — é dado real da câmera/iluminação daquele usuário.
- Se a confiança fica abaixo de 55% ou o 2º colocado chega muito perto do 1º
  (`needsReview = true`), o app mostra a sugestão junto com alternativas
  clicáveis em vez de simplesmente "confiar cegamente".

### Categoria

- Features extraídas da imagem no navegador: proporção largura/altura do
  enquadramento, saturação média, brilho médio, densidade de bordas (proxy de
  textura/estampa).
- Mesmo motor de k-NN ponderado, com limiar de confiança mais exigente (62%) —
  esse sinal é mais fraco que o de cor (não há segmentação real da peça), então o
  app pede confirmação com mais frequência.

### Teste automatizado do modelo

`netlify/functions/lib/__selftest.mts` reproduz o cenário do pedido original —
rode com:

```bash
npm install
npm run test:ml
```

Ele verifica, sem precisar de banco de dados: matiz cíclico (0°/360°), que azul
nítido classifica como azul, que **azul escuro sob luz ruim não vira rosa**, que
rosa continua sendo reconhecido, e que **uma única correção do usuário já muda o
resultado da próxima classificação** (aprendizado online).

## 4. Fluxo ponta a ponta (o que muda para o usuário)

1. Usuário tira a foto na aba Câmera.
2. O app extrai a cor dominante real (histograma de baldes de cor sobre uma grade
   de amostras — não mais 1 pixel) + sinais de categoria, e chama
   `POST /api/scan/analyze` em paralelo (sem travar a UI).
3. Ao confirmar a foto, o modal de cadastro já vem preenchido com a predição.
   Se a IA está incerta, aparece um aviso amarelo com **sugestões alternativas
   clicáveis** — a "nova análise" pedida no requisito original.
4. O usuário confirma ou corrige os campos normalmente (são inputs de texto/select
   comuns) e clica em Salvar.
5. `saveWardrobeItem()` compara o que foi salvo com o que a IA previu e chama
   `POST /api/scan/feedback` — isso grava um novo exemplo de treinamento no banco.
   **A próxima peça parecida já vai classificar melhor.**
6. Em Configurações → **Motor de IA**, um painel mostra o tamanho da base de
   treinamento, quantos exemplos vieram de correções do usuário, e uma estimativa
   de acurácia (validação cruzada leave-one-out, recalculada a cada visita —
   sobe conforme mais exemplos entram).

Todo o fluxo tem fallback: se a API/banco estiver fora do ar, o app usa a
estimativa de cor local (a mesma heurística antiga, como rede de segurança) e
guarda as correções em uma fila local (`localStorage`) para reenviar quando a
conexão voltar.

## 5. Guarda-roupa: local-first + backup em nuvem

Para não reescrever toda a extensa lógica de renderização já existente (baseada
em `localStorage`), o guarda-roupa continua **local-first**: toda leitura da UI
usa `localStorage`, como antes. A cada criação/edição, o item é também enviado
para `POST /api/wardrobe` como cópia de segurança em Postgres — isso já cria a
base para, no futuro, sincronizar entre dispositivos ou treinar por usuário.

## 6. Rodando localmente

```bash
npm install
npm run test:ml        # testa o motor de ML sem precisar de banco
netlify dev             # requer Netlify CLI logada e o site linkado — provisiona
                         # o Postgres automaticamente e roda as funções + migrações
```

## 7. Limitações honestas

- A categoria da roupa é inferida por heurísticas de forma/textura, não por uma
  rede treinada em milhões de fotos — é claramente o sinal mais fraco dos dois, e
  o app assume isso pedindo confirmação com mais frequência.
- A "densidade de bordas" é um proxy simples de textura (diferença de luminância
  entre células de uma grade), não uma detecção de estampa de verdade.
- A precisão de cor melhora rápido com uso porque o problema é bem definido
  (poucas classes, sinal forte); a de categoria melhora mais devagar.

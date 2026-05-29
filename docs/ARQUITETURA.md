# Em Paz — Arquitetura

**Versão:** 1.0
**Data:** 29 de maio de 2026
**Público alvo:** desenvolvedores que vão dar manutenção ou contribuir

---

## 1. Visão geral

O sistema é composto por **dois aplicativos independentes** (backend e frontend) que compartilham um banco de dados na nuvem. O backend roda 24/7 num servidor próprio e envia mensagens pelo WhatsApp; o frontend é uma landing pública que coleta cadastros.

```
┌─────────────────────────────────────────────────────────────────────┐
│                            USUÁRIOS                                  │
└─────────────────────────────────────────────────────────────────────┘
         │                                            │
         │ HTTPS                                      │ WhatsApp
         ▼                                            ▼
┌──────────────────────┐                ┌──────────────────────────────┐
│  Landing (Vercel)    │                │   Grupo "Em Paz" no WhatsApp │
│  Next.js 16          │                │   (até 1024 membros)         │
│  empaz.vercel.app    │                └──────────────────────────────┘
└──────────────────────┘                              ▲
         │                                            │ envia
         │ Server Action: subscribeAction             │
         ▼                                            │
┌──────────────────────┐                ┌─────────────┴────────────────┐
│  Neon Postgres       │◄───────────────┤   Backend (DigitalOcean)     │
│  AWS sa-east-1       │   leads (RW)   │   Ubuntu 24.04, 1 GB RAM     │
│  Tabela: leads       │                │   PM2 + Node.js + tsx        │
└──────────────────────┘                │   IP: 137.184.133.246        │
                                        └─────────────┬────────────────┘
                                                      │
                ┌─────────────────────────────────────┼────────────────────────┐
                │                                     │                        │
                ▼                                     ▼                        ▼
        ┌──────────────┐                  ┌──────────────┐         ┌──────────────────┐
        │ Dancrf API   │                  │  Groq API    │         │  OpenAI API      │
        │ (liturgia)   │                  │ Llama 3.3    │         │ gpt-4o-mini-tts  │
        │ HTTP GET     │                  │ Chat HTTP    │         │ TTS HTTP         │
        └──────────────┘                  └──────────────┘         └──────────────────┘
```

## 2. Componentes principais

### 2.1 Backend (`/Lit`)

Aplicação Node.js que mantém um processo persistente:

- **`src/index.ts`** — Main loop. Inicializa cliente WhatsApp, registra o cron (`0 5 * * *` em `America/Sao_Paulo`) e mantém o processo vivo.
- **`src/services/dispatch/dispatchService.ts`** — Orquestração do envio diário. Função pura `dispatchOnce(client, chatId)`.
- **`src/services/liturgy/dancrfApiSource.ts`** — Cliente HTTP para a API Dancrf v2.
- **`src/services/script/whatsappTextService.ts`** — Chama Groq para adaptar cada leitura ao formato WhatsApp.
- **`src/services/script/scriptService.ts`** — Chama Groq para gerar o roteiro falado do áudio.
- **`src/services/reflection/groqReflectionService.ts`** — Chama Groq para gerar a reflexão.
- **`src/services/tts/openaiTtsService.ts`** — Sintetiza áudio via OpenAI TTS.
- **`src/services/tts/azureTtsService.ts`** — Sintetiza áudio via Azure Speech (mantido para fallback).
- **`src/services/whatsapp/whatsappWebService.ts`** — Wrapper sobre whatsapp-web.js. Cliente persistido via LocalAuth.
- **`src/scripts/*.ts`** — Smokes manuais (rodáveis com `tsx`).
- **`src/lib/`** — utilitários (logger, retry, validators).
- **`src/config/env.ts`** — schema Zod das variáveis de ambiente.

### 2.2 Frontend (`/Lit-fr`)

Aplicação Next.js App Router:

- **`src/app/page.tsx`** — Landing pública.
- **`src/app/obrigado/page.tsx`** — Pós-cadastro: botão + QR code do grupo.
- **`src/app/privacidade/page.tsx`** — Política de Privacidade (LGPD).
- **`src/app/termos/page.tsx`** — Termos de Uso.
- **`src/app/actions/subscribe.ts`** — Server Action que processa o form, valida (Zod + anti-bot) e grava no Neon.
- **`src/app/opengraph-image.tsx`** — Imagem dinâmica de compartilhamento (Edge runtime).
- **`src/components/`** — Hero, mockup WhatsApp, form, nuvens decorativas, etc.
- **`src/lib/prisma.ts`** — Singleton Prisma Client.
- **`src/lib/rateLimit.ts`** — Rate limit por IP em memória.
- **`src/lib/validators.ts`** — Schemas Zod.

## 3. Fluxos de dados

### 3.1 Fluxo do dispatch diário (cron 5h)

```
┌─────────────┐
│ node-cron   │ dispara às 0 5 * * * em America/Sao_Paulo
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────┐
│ dispatchOnce(client, chatId)     │
└──────┬───────────────────────────┘
       │
       ▼
   1. Busca liturgia ──────► DancrfApiSource ──► HTTPS GET ──► Dancrf API
       │                                                       │
       │◄──────────────────────────────────────────────────────┘
       │ liturgia (JSON parseado)
       ▼
   2. Adapta leituras ─────► GroqWhatsappTextService ──► Chat Completion ──► Groq
       │                                                                     │
       │◄────────────────────────────────────────────────────────────────────┘
       │ texto adaptado por seção (JSON)
       ▼
   3. Gera roteiro ────────► GroqScriptService ────► Chat Completion ──► Groq
       │                                                                 │
       │◄────────────────────────────────────────────────────────────────┘
       │ roteiro narrado
       ▼
   4. Gera reflexão ───────► GroqReflectionService ─► Chat Completion ──► Groq
       │                                                                 │
       │◄────────────────────────────────────────────────────────────────┘
       │ reflexão
       ▼
   5. Sintetiza áudio ─────► OpenAiTtsService ──────► TTS API ──────────► OpenAI
       │     (se não cacheado em                                          │
       │      storage/audios/full/YYYY-MM-DD-onyx.mp3)                    │
       │◄────────────────────────────────────────────────────────────────┘
       │ mp3
       ▼
   6. Envia mensagens ─────► whatsapp-web.js ──────► Chromium ─────► WhatsApp Web
       │
       │ Ordem das mensagens:
       │   a. Cabeçalho (☀️ + título + cor litúrgica)
       │   b. Cada leitura adaptada (📖 + título + referência + texto)
       │   c. Rótulo "Áudio:"
       │   d. mp3 enviado como voice note
       │   e. Reflexão (🕊️ + texto)
       ▼
   ✓ Concluído
```

**Tempo total**: ~20 segundos (com áudio cacheado), ~45 segundos (gerando áudio novo).

### 3.2 Fluxo de cadastro na landing

```
┌────────────────────────┐
│ Usuário preenche form  │
│  nome, email, whatsapp │
│  marca consent LGPD    │
└──────────┬─────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ subscribeAction (Server Action)                                       │
│                                                                       │
│  1. Honeypot — campo "website" oculto deve estar vazio                │
│     se preenchido → fingir sucesso e parar (sem persistir)            │
│                                                                       │
│  2. Tempo de preenchimento — entre 3s e 1h                            │
│     se fora → erro "preencheu muito rápido / página antiga"           │
│                                                                       │
│  3. Rate limit por IP — max 3 cadastros/IP/hora                       │
│     se excedido → erro "muitas tentativas"                            │
│                                                                       │
│  4. Validação Zod (subscribeSchema)                                   │
│     se inválido → retorna fieldErrors                                 │
│                                                                       │
│  5. Consent LGPD obrigatório                                          │
│     se false → erro "marque a Política de Privacidade"                │
│                                                                       │
│  6. INSERT no Postgres via Prisma                                     │
│     (P2002 = email duplicado → fingir sucesso para não vazar base)    │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
   redirect("/obrigado")
           │
           ▼
┌──────────────────────────────────────────────┐
│ Página /obrigado                              │
│  ▸ botão grande "Entrar no grupo no WhatsApp" │
│    → window.open(NEXT_PUBLIC_WHATSAPP_GROUP)  │
│  ▸ QR code (qrcode.react) do mesmo link       │
└──────────────────────────────────────────────┘
```

## 4. APIs e contratos

### 4.1 APIs externas consumidas

#### Dancrf v2 (liturgia)
- **Endpoint**: `https://liturgia.up.railway.app/v2/?dia=DD&mes=MM&ano=AAAA`
- **Auth**: Nenhuma
- **Response**: JSON com `data`, `cor`, `liturgia`, `primeiraLeitura`, `salmo`, `segundaLeitura`, `evangelho`
- **Adapter**: `DancrfApiSource` em `src/services/liturgy/dancrfApiSource.ts`
- **Rate limit**: Sem documentação, mas baixo volume — uma chamada por dispatch

#### Groq Chat Completions
- **Endpoint**: `https://api.groq.com/openai/v1/chat/completions` (compatível OpenAI)
- **Auth**: Header `Authorization: Bearer ${GROQ_API_KEY}`
- **Model**: `llama-3.3-70b-versatile`
- **Volume**: 3 chamadas por dispatch × 30 dias = 90 chamadas/mês
- **Free tier**: limites bem acima do necessário (em maio/2026: ~30 RPM e ~14k TPM)

#### OpenAI Audio Speech
- **Endpoint**: `https://api.openai.com/v1/audio/speech`
- **Auth**: Header `Authorization: Bearer ${OPENAI_API_KEY}`
- **Model**: `gpt-4o-mini-tts`
- **Voice**: `onyx`
- **Format**: `mp3` (default)
- **Custo**: ~$0.015/minuto de áudio gerado

#### Azure Cognitive Services Speech (fallback futuro)
- **Endpoint**: REST/SDK via region `brazilsouth`
- **Auth**: Header `Ocp-Apim-Subscription-Key: ${AZURE_SPEECH_KEY}`
- **Voice (planejado)**: `pt-BR-ThalitaMultilingualNeural` (feminina) ou `pt-BR-MacerioMultilingualNeural` (masculina)
- **Free tier**: 500k caracteres/mês

### 4.2 Endpoints internos do backend

O backend **não expõe HTTP** atualmente. Toda interação é via CLI (npm scripts) ou pelo cron interno.

| Comando | Descrição |
|---|---|
| `npm run service` | Sobe o main loop em produção (usado pelo PM2) |
| `npm run smoke:dispatch` | Roda um dispatch one-shot agora |
| `npm run smoke:dispatch:test` | Mesmo, mas força destino = WHATSAPP_TEST_NUMBER |
| `npm run pair` | Pareia uma nova sessão WhatsApp Web (gera QR) |
| `npm run groups` | Lista grupos do bot com seus IDs |
| `npm run smoke:liturgy` | Testa o parser de liturgia |
| `npm run smoke:reflection` | Testa geração de reflexão |
| `npm run smoke:openai` | Gera amostras nas 6 vozes OpenAI |
| `npm run smoke:final` | Gera Onyx + Nova com prompts atuais |
| `npm run smoke:wtext` | Preview no console das mensagens WhatsApp (sem enviar) |
| `npm run db:migrate` | Roda migrations Prisma em dev |
| `npm run db:push` | Sincroniza schema sem migration (Neon) |

### 4.3 Endpoints do frontend

| Rota | Tipo | Descrição |
|---|---|---|
| `/` | Static | Landing pública |
| `/privacidade` | Static | Política de Privacidade |
| `/termos` | Static | Termos de Uso |
| `/obrigado` | Static | Pós-cadastro com link + QR do grupo |
| `/opengraph-image` | Dynamic (Edge) | Imagem 1200x630 para compartilhamento |
| `/icon.svg` | Static asset | Favicon (cruz dourada) |
| (Server Action) `subscribeAction` | POST implícito | Processa o form na home |

## 5. Modelo de dados (Prisma + Postgres)

```prisma
model Lead {
  id        String      @id @default(cuid())
  name      String
  email     String      @unique
  whatsapp  String?
  status    LeadStatus  @default(WAITING)
  source    String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
}

enum LeadStatus {
  WAITING
  INVITED
  ACTIVE
  UNSUBSCRIBED
}
```

A tabela `leads` é **a única em uso ativo** hoje. Outras tabelas (liturgies, audios, dispatches, whatsapp_sessions) existem no schema mas não são populadas atualmente — foram preparadas para implementação futura de auditoria/histórico.

## 6. Variáveis de ambiente

### Backend (`Lit/.env`)
| Nome | Onde usa | Exemplo |
|---|---|---|
| `NODE_ENV` | Geral | `production` |
| `LOG_LEVEL` | Pino logger | `info` |
| `DATABASE_URL` | Prisma | `postgresql://...neon.tech/neondb?sslmode=require` |
| `DISPATCH_CRON` | node-cron | `0 5 * * *` |
| `DISPATCH_TZ` | node-cron | `America/Sao_Paulo` |
| `GROQ_API_KEY` | GroqReflectionService, ScriptService, WhatsappTextService | `gsk_...` |
| `GROQ_MODEL` | idem | `llama-3.3-70b-versatile` |
| `AZURE_SPEECH_KEY` | AzureTtsService (fallback futuro) | `...` |
| `AZURE_SPEECH_REGION` | idem | `brazilsouth` |
| `OPENAI_API_KEY` | OpenAiTtsService | `sk-proj-...` |
| `OPENAI_TTS_MODEL` | idem | `gpt-4o-mini-tts` |
| `WHATSAPP_GROUP_ID` | DispatchService (destino) | `120363...@g.us` |
| `WHATSAPP_BOT_NUMBER` | Script de pair | `558173347043` |
| `WHATSAPP_TEST_NUMBER` | Smoke com --test | `5581992264208` |
| `WHATSAPP_ADMIN_NUMBER` | Reservado (alertas futuros) | `stub-not-yet-used` |
| `AUDIO_STORAGE_PATH` | Defaults de cache | `./storage/audios` |

### Frontend (`Lit-fr/.env` e `Lit-fr/.env.local`)
| Nome | Onde usa |
|---|---|
| `DATABASE_URL` | Prisma (mesmo Neon que o backend) |
| `NEXT_PUBLIC_WHATSAPP_GROUP_INVITE_URL` | Página /obrigado (link wa.me + QR) |

## 7. Infraestrutura

### 7.1 Servidor (DigitalOcean Droplet)

- **Especificação**: Ubuntu 24.04 LTS, 1 vCPU, 1 GB RAM, 25 GB SSD
- **Região**: NYC1
- **IP fixo**: 137.184.133.246
- **Custo**: $6/mês
- **Stack instalada**:
  - Node.js 22 (via NodeSource)
  - npm
  - Docker (legado, Postgres local não está mais em uso)
  - PM2 (process manager)
  - Dependências do Chromium (libnss3, libgbm1, etc — necessárias pro whatsapp-web.js)
- **Swap configurado**: 2 GB (`/swapfile`) — necessário porque o Chromium pode pedir mais que 1 GB em picos
- **PM2 startup**: configurado via systemd, sobe automaticamente em reboot
- **Processo gerenciado**: `empaz` (rodando `npm run service`)

### 7.2 Vercel (frontend)

- **Plano**: Free (Hobby)
- **Build**: `prisma generate && next build` (Prisma generate é obrigatório por causa do cache da Vercel — falha silenciosa em runtime se omitido)
- **Edge runtime**: usado em `/opengraph-image` para geração de imagem dinâmica
- **Env vars**: `DATABASE_URL`, `NEXT_PUBLIC_WHATSAPP_GROUP_INVITE_URL` (ambas em Production + Preview)

### 7.3 Neon Postgres

- **Plano**: Free (0.5 GB de storage, suspende compute após 5 min ocioso)
- **Região**: AWS sa-east-1 (São Paulo)
- **Connection pooling**: ativado (URL `-pooler` no host)
- **Schema gerenciado por**: `prisma db push` (sem migrations versionadas no Neon)
- **Limitação conhecida**: após 5 min ocioso, o Prisma vê `Connection Closed` no próximo uso. Cliente reconecta sozinho mas loga ruído.

## 8. Segurança

### 8.1 Em produção
- **TLS/HTTPS**: forçado pelo Vercel (front) e por padrão na conexão com Neon (sslmode=require).
- **Secrets**: nunca em código. `.env` está no `.gitignore` em ambos os repos.
- **WhatsApp Web**: pasta `.wweb-auth/` com a sessão também está no `.gitignore`. Em backup, deve ser criptografada.

### 8.2 No formulário
| Camada | O que faz |
|---|---|
| Honeypot | Campo `website` invisível; se preenchido, bot é tratado como sucesso falso |
| Tempo de preenchimento | Server rejeita submissões em menos de 3s ou mais de 1h |
| Rate limit por IP | Máx 3 cadastros por IP por hora (Map em memória) |
| Consent LGPD | Server rejeita sem o checkbox marcado |
| Zod | Valida formato de nome, email, whatsapp |
| Email duplicado | Tratado como sucesso silencioso (não vaza a base) |

### 8.3 LGPD
- **Controlador**: Pedro Henrique Soares Rossiter (pessoa física, Recife/PE)
- **Base legal**: consentimento (Art. 7º, I)
- **Direitos atendidos manualmente via email**: contato em `pedrorossiter@gmail.com`
- **Retenção**: enquanto inscrito; após pedido de exclusão, até 30 dias

## 9. Estratégia de resilência

### Atual
- **Retry com backoff**: `lib/retry.ts` envolve chamadas a APIs externas (Groq, Azure)
- **Cache de áudio**: o mesmo dia não regenera mp3
- **PM2 auto-restart**: reinicia o processo se ele crashar
- **Idempotência de cron**: flag `isDispatching` impede execuções sobrepostas

### Pendente (roadmap técnico)
- [ ] **Try/catch por mensagem WhatsApp**: hoje, se um `client.sendMessage` falha, derruba o dispatch inteiro. Próximo passo: cada send tem retry e o loop continua mesmo que um falhe.
- [ ] **Fallback OpenAI → Azure no TTS**: ao falhar OpenAI 2x, cair pra Azure com Thalita/Macerio.
- [ ] **Healthcheck**: endpoint HTTP simples (ou ping pra UptimeRobot) que reporta "OK" se o último dispatch foi <26h atrás.
- [ ] **Warmup do Neon**: query trivial a cada 4 min pra manter o compute acordado.

## 10. Decisões arquiteturais relevantes

### 10.1 Por que whatsapp-web.js em vez de Baileys
Baileys reimplementa o protocolo WhatsApp do zero (engenharia reversa). Em testes em maio/2026 com o chip do projeto, o pareamento Baileys falhou repetidamente — o WhatsApp marca esses clientes não-oficiais como suspeitos. whatsapp-web.js controla o **WhatsApp Web oficial** via Chromium headless, então passa nas heurísticas anti-bot. Trade-off: consome ~200-400 MB de RAM em vez de ~50 MB.

### 10.2 Por que Groq em vez de OpenAI para texto
O free tier do Groq é generosíssimo (~14k TPM, ~30 RPM) e o Llama 3.3 70B serve bem para adaptação de texto e geração de reflexões. A OpenAI seria muito mais cara para o volume de tokens consumidos. Reservamos OpenAI para o TTS, onde a qualidade da voz tem peso maior.

### 10.3 Por que OpenAI TTS em vez de Azure
Em testes A/B com texto idêntico (mesmo roteiro), as vozes Onyx e Nova da OpenAI soaram mais naturais e expressivas que `pt-BR-MacerioMultilingualNeural` e `pt-BR-ThalitaMultilingualNeural` do Azure. Azure permanece como fallback porque é gratuito no nosso volume e a infraestrutura já está no `.env`.

### 10.4 Por que Neon em vez de Postgres no próprio servidor
O frontend (Vercel) precisa gravar leads, e o servidor DigitalOcean (NYC) precisa eventualmente ler/atualizar status. Centralizar num Postgres serverless (Neon) elimina a necessidade de expor porta no servidor ou criar uma camada de API HTTP entre eles.

### 10.5 Por que Vercel em vez de servir o frontend do mesmo Droplet
Next.js é otimizado para Vercel (edge runtime, image optimization, OG image dinâmica). O free tier cobre nosso tráfego sem desconforto. Servir do Droplet exigiria proxy reverso (nginx), gestão de certificados (Let's Encrypt) e mais RAM no servidor — sem ganho funcional.

### 10.6 Por que 1 áudio em vez de 2
Em 28/05/2026, o dispatch das 5h falhou pela metade. Diagnóstico: o Chromium do whatsapp-web.js entrou em swap durante o envio dos dois áudios e a Promise da chamada `sendMessage` expirou (`Protocol error: Promise was collected`). Cortar para 1 áudio reduziu pela metade a pressão de memória durante o envio. Voltar pra 2 vozes exige upgrade do droplet (2 GB / $12 mês) ou alterações maiores no fluxo de envio.

## 11. Estratégia de deploy

### Backend
- Push pro `main` no GitHub não dispara nada automático
- Para aplicar mudanças:
  1. SSH no servidor: `ssh root@137.184.133.246`
  2. `cd empaz && git pull origin main`
  3. Se houve mudança em deps: `npm install`
  4. Se houve mudança no schema: `npx prisma generate && npx prisma db push`
  5. `pm2 restart empaz`
- Validação: `pm2 logs empaz --lines 30` deve mostrar "Cron registrado"

### Frontend
- Vercel observa o `main` do `Lit-fr` no GitHub
- Cada push dispara build automático (~2 min)
- Preview deploys para branches/PRs (URL única por branch)

## 12. Observabilidade

| O quê | Como |
|---|---|
| Logs do backend | `pm2 logs empaz [--err] [--out] --lines N` |
| Logs de erros isolados | `pm2 logs empaz --err --nostream` |
| Status do processo | `pm2 status` |
| Memória do servidor | `free -h` |
| Espaço em disco | `df -h /` |
| Métricas Vercel | Painel da Vercel (Analytics tab) |
| Erros no frontend | Vercel logs (Functions tab) |

**Pendente**: alertas ativos (UptimeRobot, Telegram bot, email).

## 13. Roadmap técnico

### Curto prazo
- [ ] Implementar fallback Azure quando OpenAI TTS falhar 2x seguidas
- [ ] Try/catch por `client.sendMessage` com retry de 2 tentativas e log estruturado por falha
- [ ] Reordenar envio: reflexão antes do áudio (o que importa mais primeiro)

### Médio prazo
- [ ] Endpoint HTTP `/health` no backend que retorna 200 se último dispatch <26h
- [ ] Integração UptimeRobot apontando para esse `/health`
- [ ] Warmup do Neon (query `SELECT 1` a cada 4 min)
- [ ] Persistir métricas de dispatch em tabela `dispatches` (tokens consumidos, tempo, falhas)

### Longo prazo
- [ ] Migrar para WhatsApp Business API oficial (ao passar de ~500 inscritos)
- [ ] Backup automático do Neon para DO Spaces
- [ ] Endpoint público `/exclusao` para LGPD com link mágico por email
- [ ] CI básico no GitHub Actions (typecheck + build em PR)
- [ ] Possível migração para containerização (Dockerfile + docker-compose já existem no repo)

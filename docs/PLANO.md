# Em Paz — Plano de Projeto

**Versão:** 1.0
**Data:** 29 de maio de 2026
**Responsável:** Pedro Henrique Soares Rossiter

---

## 1. O que é o Em Paz

O **Em Paz** é um bot de WhatsApp que envia, todo dia às 5 da manhã, um pacote completo de meditação católica para um grupo de fiéis brasileiros. O envio é totalmente automatizado e inclui:

- A liturgia do dia (leituras, salmo e Evangelho) adaptada para leitura no celular;
- Um áudio narrado por IA com voz humanizada;
- Uma reflexão prática gerada por IA, conectando o tema do dia à vida real.

A proposta é entregar a liturgia diária no canal onde o usuário já está (WhatsApp), com tom acolhedor e sem fricção: a pessoa abre o celular pela manhã e a liturgia já está lá.

## 2. Visão e princípios

| Princípio | Como se traduz no produto |
|---|---|
| Acessibilidade | Roda no WhatsApp — não precisa baixar app nem criar conta |
| Acolhimento | Tom "Headspace católico": calmo, sem alarmismo, sem pieguice |
| Fidelidade | A liturgia vem de fonte oficial; a IA adapta a linguagem, não o conteúdo |
| Sobriedade | Poucas mensagens, emojis discretos, áudio no lugar de muito texto |
| Custo baixo | MVP funcional por menos de R$ 50/mês total |

## 3. Escopo

### O que o produto FAZ

- Envia, todo dia às 5h (horário de Brasília), no grupo de WhatsApp:
  - Cabeçalho com data e cor litúrgica
  - Cada leitura como uma mensagem própria (texto adaptado pela IA)
  - Um áudio narrado da liturgia inteira (voz Onyx OpenAI)
  - Uma reflexão IA (3 parágrafos + pergunta final)
- Oferece uma landing pública para cadastro: nome, email, WhatsApp opcional
- Após o cadastro, libera o link e QR code de entrada no grupo
- Armazena os leads em banco para retenção, comunicação futura e métricas

### O que o produto NÃO FAZ (escopo cortado deliberadamente)

- Não adiciona pessoas ao grupo automaticamente (o usuário entra pelo link)
- Não envia mensagens individuais via WhatsApp
- Não oferece consulta histórica de liturgias passadas
- Não tem app mobile próprio
- Não monetiza (gratuito, sem fins lucrativos não declarado em política)
- Não tem cobertura litúrgica para outros ritos (só rito romano em pt-BR)

## 4. Status atual (29/05/2026)

| Frente | Status |
|---|---|
| Backend rodando 24/7 (DigitalOcean) | ✅ Em produção |
| Cron diário 5h America/Sao_Paulo | ✅ Funcionando |
| Sessão WhatsApp persistente | ✅ Pareada no servidor |
| Grupo "Em Paz" no WhatsApp | ✅ Criado, modo "só admin envia" |
| Landing pública (empaz.vercel.app) | ✅ Publicada |
| Captação de leads (Neon Postgres) | ✅ Funcionando |
| Política de Privacidade e Termos | ✅ Publicadas, alinhadas com LGPD mínima |
| Anti-bot no formulário | ✅ Honeypot + rate limit + tempo |
| Áudio único Onyx (OpenAI) | ✅ Em produção desde 29/05 |
| Validação com primeiros usuários | 🟡 Em andamento (amigos/família) |
| Divulgação ampla | ❌ Pendente |
| Fallback de TTS (Azure) | ❌ Pendente |
| Healthcheck / alertas | ❌ Pendente |

## 5. Stack de tecnologia

### Backend (servidor que envia)
| Camada | Tecnologia | Por que |
|---|---|---|
| Linguagem | TypeScript (strict) | Tipagem estática evita erros runtime |
| Runtime | Node.js 22 | LTS recente, compatibilidade com bibliotecas modernas |
| Orquestração | node-cron | Lib simples e bem testada para agendamento |
| WhatsApp | whatsapp-web.js | Cliente oficial via Chromium — passa em heurísticas anti-bot |
| ORM | Prisma 5 | Type-safe, migrations, integração natural com TypeScript |
| Logger | Pino | Rápido e estruturado, fácil de filtrar |
| Validação | Zod | Schemas runtime + tipos derivados |
| Process manager | PM2 | Mantém o serviço vivo 24/7, restart automático |

### Frontend (landing)
| Camada | Tecnologia | Por que |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server Components, Server Actions, edge runtime |
| UI lib | React 19 | Stable concurrent features |
| Estilo | Tailwind CSS 4 | Design tokens via @theme, classes utilitárias |
| Fontes | Cormorant Garamond + Inter | Serifa elegante para títulos, sans clean para corpo |
| Tracking | Vercel Analytics | Privacy-friendly, free tier suficiente |
| QR code | qrcode.react | Componente React puro |

### IA e Áudio
| Serviço | Uso | Modelo |
|---|---|---|
| Groq | Texto adaptado, roteiro, reflexão | Llama 3.3 70B Versatile |
| OpenAI | Síntese de voz | gpt-4o-mini-tts (voz Onyx) |
| Azure Speech | Fallback TTS (planejado) | Multilingual Neural |

### Persistência
| Sistema | Para que serve |
|---|---|
| Neon Postgres (AWS sa-east-1) | Tabela `leads`, compartilhada com o front |
| Filesystem do servidor | Cache de áudios (`storage/audios/full/YYYY-MM-DD-onyx.mp3`) |
| Filesystem do servidor | Sessão WhatsApp Web (`.wweb-auth/`) |

### Infraestrutura
| Serviço | Recurso |
|---|---|
| DigitalOcean Droplet | Ubuntu 24.04, 1 GB RAM, 25 GB SSD, NYC1 — $6/mês |
| Vercel | Hospedagem da landing, plano free |
| Neon | Postgres serverless, plano free (0.5 GB) |
| GitHub | Repos privados/públicos (Lit + Lit-fr) |

### Fontes de conteúdo
| Fonte | Para que |
|---|---|
| API Dancrf v2 | Liturgia católica diária em pt-BR (gratuita) |

## 6. Custos mensais

| Item | Custo | Observação |
|---|---|---|
| DigitalOcean Droplet (1 GB) | **$6** | Fixo, cobrado todo mês |
| OpenAI TTS (1 voz Onyx) | **~$1.50** | Consumo: ~30 min de áudio gerado por mês |
| Azure Speech | $0 | Free tier (500k chars/mês) — só usado em fallback |
| Groq Llama 3.3 | $0 | Free tier generoso |
| Neon Postgres | $0 | Free tier (suspende após 5 min ocioso) |
| Vercel | $0 | Free tier |
| Dancrf API | $0 | Gratuita |
| **Total** | **~$7.50/mês (R$ 38)** | |

## 7. Roadmap

### Próximos 7 dias (curto prazo)
- [ ] Coletar feedback dos primeiros usuários (amigos/família no grupo)
- [ ] Ajustar tamanho/profundidade do texto adaptado das leituras
- [ ] Avaliar consistência da entrega (passou 1 dia, 3 dias, 7 dias?)

### Próximos 30 dias (médio prazo)
- [ ] Implementar fallback de TTS (Azure quando OpenAI falhar)
- [ ] Adicionar resilência por mensagem (try/catch + retry) no dispatch
- [ ] Healthcheck e alerta de falha (UptimeRobot ou Telegram bot)
- [ ] Reconexão automática Neon (quando suspender após inatividade)
- [ ] Iniciar divulgação em comunidades católicas (Facebook, Instagram)

### Próximos 90 dias (longo prazo, se houver tração)
- [ ] Migrar para WhatsApp Business API oficial (quando passar de ~500 inscritos)
- [ ] Múltiplos grupos por região (limite WhatsApp = 1024 membros/grupo)
- [ ] Backup automático do banco
- [ ] Endpoint público de exclusão LGPD
- [ ] Eventualmente: domínio próprio (custom .com.br)

## 8. Riscos conhecidos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Ban do número WhatsApp (Meta detecta bot) | Média | Migrar para Business API oficial em escala |
| OpenAI TTS fora do ar | Baixa | Fallback Azure (a implementar) |
| Chromium estourar RAM no servidor 1 GB | Baixa-Média (já mitigado com 1 voz) | Upgrade pra 2 GB se necessário ($12/mês) |
| Reflexão IA com erro doutrinário | Baixa | Disclaimer no grupo de que IA não substitui orientação espiritual |
| Direitos autorais das traduções litúrgicas | Baixa | Citar fonte (Dancrf) na política, manter sem fins comerciais |
| LGPD: vazamento de dados | Baixa | Chaves rotacionáveis, TLS, banco gerenciado |

## 9. Decisão sobre IA

A IA é usada como **camada de adaptação**, nunca como fonte primária de conteúdo religioso:

- **Texto das leituras**: adapta linguagem (remove arcaismos, quebra em parágrafos), preservando o sentido fiel ao texto original.
- **Roteiro do áudio**: parafraseia para soar conversacional, mas não inventa fatos bíblicos.
- **Reflexão**: gerada a partir do tema do dia, com prompt que proíbe citação fora da liturgia.

Em todos os casos, a fonte primária é a liturgia oficial da Dancrf.

## 10. Equipe e processo

- **Desenvolvimento**: Pedro Henrique Soares Rossiter (solo)
- **Apoio**: Claude (Anthropic) — pair programming via Claude Code
- **Repositórios**:
  - Backend: https://github.com/PedroRossiter/Lit
  - Frontend: https://github.com/PedroRossiter/Lit-fr
- **Deploy**:
  - Backend: manual via SSH + `git pull && pm2 restart empaz`
  - Frontend: automático via Vercel ao push pro `main`

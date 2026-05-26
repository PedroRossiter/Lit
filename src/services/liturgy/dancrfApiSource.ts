import { z } from 'zod';
import type {
  LiturgicalColor,
  LiturgySection,
  ParsedLiturgy,
  SectionKind,
} from '../../domain/liturgy.js';
import { logger } from '../../lib/logger.js';
import { withRetry } from '../../lib/retry.js';
import { SourceError, type LiturgySource } from './source.js';

const BASE_URL = 'https://liturgia.up.railway.app/v2';

// Schema do response da API. Vai estourar zod parse se a API mudar formato.
const readingSchema = z.object({
  referencia: z.string(),
  titulo: z.string().optional(),
  refrao: z.string().optional(),
  texto: z.string(),
});

const apiResponseSchema = z.object({
  data: z.string(), // "DD/MM/YYYY"
  liturgia: z.string(),
  cor: z.enum(['Verde', 'Vermelho', 'Roxo', 'Rosa', 'Branco']).optional(),
  leituras: z.object({
    primeiraLeitura: z.array(readingSchema),
    salmo: z.array(readingSchema),
    segundaLeitura: z.array(readingSchema),
    evangelho: z.array(readingSchema),
  }),
});

type ApiResponse = z.infer<typeof apiResponseSchema>;

export class DancrfApiSource implements LiturgySource {
  readonly name = 'dancrf-v2';

  async fetch(date?: Date): Promise<ParsedLiturgy> {
    const url = buildUrl(date);

    const json = await withRetry(
      async () => {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'LiturgiaPro/0.1' },
        });
        if (res.status === 404) {
          throw new SourceError(`Liturgia nao encontrada para ${url}`, this.name);
        }
        if (!res.ok) {
          throw new SourceError(`HTTP ${res.status} em ${url}`, this.name);
        }
        return (await res.json()) as unknown;
      },
      {
        maxAttempts: 3,
        onRetry: (attempt, err) =>
          logger.warn({ attempt, err, url }, 'Retry buscando liturgia'),
      },
    );

    const parsed = apiResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SourceError(
        `Resposta da API com schema invalido: ${parsed.error.message}`,
        this.name,
        parsed.error,
      );
    }

    return this.toDomain(parsed.data, url);
  }

  private toDomain(api: ApiResponse, url: string): ParsedLiturgy {
    const sections: LiturgySection[] = [];

    pushFirst(api.leituras.primeiraLeitura, 'PRIMEIRA_LEITURA', sections);
    pushSalmo(api.leituras.salmo, sections);
    pushFirst(api.leituras.segundaLeitura, 'SEGUNDA_LEITURA', sections);
    pushFirst(api.leituras.evangelho, 'EVANGELHO', sections);

    if (sections.length === 0) {
      throw new SourceError('Nenhuma secao com conteudo retornada pela API', this.name);
    }

    return {
      date: parseBrDate(api.data),
      title: api.liturgia,
      liturgicalColor: api.cor as LiturgicalColor | undefined,
      sourceUrl: url,
      sourceName: this.name,
      sections,
    };
  }
}

// Helper: primeira opcao das leituras nao-salmo (ignora opcoes alternativas).
function pushFirst(
  readings: z.infer<typeof readingSchema>[],
  kind: SectionKind,
  out: LiturgySection[],
): void {
  const first = readings[0];
  if (!first || !first.texto.trim()) return;
  out.push({
    kind,
    reference: first.referencia,
    text: first.texto.trim(),
  });
}

// Salmo tem refrao + estrofes. Concatena refrao antes do texto para narracao.
function pushSalmo(
  readings: z.infer<typeof readingSchema>[],
  out: LiturgySection[],
): void {
  const first = readings[0];
  if (!first || !first.texto.trim()) return;
  const parts: string[] = [];
  if (first.refrao?.trim()) parts.push(`Refrao: ${first.refrao.trim()}`);
  parts.push(first.texto.trim());
  out.push({
    kind: 'SALMO',
    reference: first.referencia,
    text: parts.join('\n\n'),
  });
}

// Constroi a URL com data opcional (path-style /DD-MM-YYYY).
function buildUrl(date?: Date): string {
  if (!date) return `${BASE_URL}/`;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${BASE_URL}/${dd}-${mm}-${yyyy}`;
}

// Converte "DD/MM/YYYY" da API para Date local 00:00.
function parseBrDate(s: string): Date {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) throw new SourceError(`Data invalida da API: ${s}`, 'dancrf-v2');
  const [, dd, mm, yyyy] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

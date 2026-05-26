import type { ParsedLiturgy } from '../../domain/liturgy.js';

// Interface comum para qualquer fonte de liturgia (CN, CNBB, etc.).
// Permite trocar a fonte sem mexer no orquestrador.
export interface LiturgySource {
  readonly name: string;

  // Busca a liturgia da data informada (ou de hoje se nao passar nada).
  // Lanca SourceError se o conteudo nao puder ser parseado.
  fetch(date?: Date): Promise<ParsedLiturgy>;
}

export class SourceError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SourceError';
  }
}

import type { GraphQLRequestMetadata } from '@spotify-confidence/csr-common';

function operationNameFromDocument(document: string): string | undefined {
  const match = document.match(/\b(?:query|mutation|subscription)\s+([_A-Za-z][_0-9A-Za-z]*)/);
  return match?.[1];
}

function operationNameFromBody(body: unknown): string | undefined {
  if (typeof body !== 'string') return undefined;
  try {
    const request = JSON.parse(body) as { operationName?: unknown; query?: unknown };
    if (typeof request.operationName === 'string' && request.operationName) return request.operationName;
    return typeof request.query === 'string' ? operationNameFromDocument(request.query) : undefined;
  } catch (_error) {
    return operationNameFromDocument(body);
  }
}

function isGraphQLRequestUrl(url: string): boolean {
  try {
    return new URL(url, globalThis.location?.href).pathname.endsWith('/graphql');
  } catch (_error) {
    return url.split(/[?#]/, 1)[0].endsWith('/graphql');
  }
}

export function extractGraphQLRequestMetadata(url: string, body: unknown): GraphQLRequestMetadata | undefined {
  if (!isGraphQLRequestUrl(url)) return undefined;

  const operationName = operationNameFromBody(body);
  return operationName ? { operationName } : undefined;
}

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}, got "${raw}"`);
  }
  return parsed;
}

function urlFromEnv(name: string, fallback: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  try {
    return new URL(raw).toString();
  } catch {
    throw new Error(`${name} must be a valid URL, got "${raw}"`);
  }
}

function listFromEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const items = raw.split(',').map((s) => s.trim()).filter((s) => s !== '');
  if (items.length === 0) throw new Error(`${name} must list at least one origin`);
  return items;
}

export const config = {
  port: intFromEnv('PORT', 3000, 1, 65535),
  env: process.env['NODE_ENV'] ?? 'development',

  /** Static stop and route graph. */
  graphBaseUrl: urlFromEnv('GRAPH_BASE_URL', 'https://data.busrouter.sg/v1/'),
  /** Live arrival predictions; the stop code is appended as ?id=. */
  arrivalsUrl: urlFromEnv('ARRIVALS_URL', 'https://arrivelah2.busrouter.sg/'),

  /**
   * arrivelah2 sends Cache-Control: max-age=15. Caching for less than that just
   * adds load upstream without fresher data.
   */
  arrivalsTtlMs: intFromEnv('ARRIVALS_TTL_MS', 15_000, 1_000, 300_000),
  graphRefreshMs: intFromEnv('GRAPH_REFRESH_MS', 24 * 60 * 60 * 1000, 60_000, 7 * 24 * 60 * 60 * 1000),
  upstreamTimeoutMs: intFromEnv('UPSTREAM_TIMEOUT_MS', 8_000, 500, 60_000),

  /** Origins allowed to call this API from a browser; "*" for any. */
  corsOrigins: listFromEnv('CORS_ORIGINS', ['*']),
} as const;

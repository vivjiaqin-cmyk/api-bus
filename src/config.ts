function port(): number {
  const raw = process.env['PORT'];
  if (raw === undefined || raw === '') return 3000;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${raw}"`);
  }
  return parsed;
}

export const config = {
  port: port(),
  env: process.env['NODE_ENV'] ?? 'development',
} as const;

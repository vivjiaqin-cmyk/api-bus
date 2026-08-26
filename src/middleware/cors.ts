import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

/**
 * This API is read-only and unauthenticated, so it is safe to share with any
 * origin — the same stance arrivelah2 takes, and the reason a static page can
 * call it with no backend of its own.
 *
 * Set CORS_ORIGINS to a comma-separated list to narrow it. Credentials are never
 * allowed: nothing here is per-user, and echoing an arbitrary origin back with
 * credentials enabled is how open APIs become confused-deputy problems.
 */
export function cors(req: Request, res: Response, next: NextFunction): void {
  const allowed = config.corsOrigins;
  const origin = req.headers.origin;

  if (allowed.length === 1 && allowed[0] === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin !== undefined && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    // Caches must not serve one origin's response to another.
    res.setHeader('Vary', 'Origin');
  } else if (origin !== undefined) {
    // Not allowed: send no CORS header at all and let the browser refuse.
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

import type { NextFunction, Request, Response } from 'express';
import { isReady } from '../data/graph.js';

/**
 * The server starts listening before the route graph has finished downloading, so
 * that /health can answer immediately and a container never looks dead while it
 * is merely warming up. Everything that needs the graph waits behind this.
 */
export function requireGraph(_req: Request, res: Response, next: NextFunction): void {
  if (isReady()) {
    next();
    return;
  }
  res.status(503).json({
    error: 'Route graph is still loading; retry shortly.',
  });
}

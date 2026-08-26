import { Router } from 'express';
import { graphStatus } from '../data/graph.js';

export const healthRouter: Router = Router();

const startedAt = Date.now();

/**
 * Answers even before the route graph has loaded, reporting `ready: false` so a
 * probe can tell "still warming up" apart from "broken".
 */
healthRouter.get('/health', (_req, res) => {
  const graph = graphStatus();
  res.status(graph.ready ? 200 : 503).json({
    status: graph.ready ? 'ok' : 'starting',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    graph,
  });
});

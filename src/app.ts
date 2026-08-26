import express, { type Express } from 'express';
import { errorHandler, notFound } from './middleware/errors.js';
import { healthRouter } from './routes/health.js';
import { routesRouter } from './routes/routes.js';
import { stopsRouter } from './routes/stops.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({
      name: 'api-bus',
      endpoints: [
        'GET /health',
        'GET /routes',
        'GET /routes/:routeId',
        'GET /routes/:routeId/stops',
        'GET /stops',
        'GET /stops/:stopId',
        'GET /stops/:stopId/arrivals',
      ],
    });
  });

  app.use(healthRouter);
  app.use(routesRouter);
  app.use(stopsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

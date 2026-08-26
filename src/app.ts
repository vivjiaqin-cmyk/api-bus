import express, { type Express } from 'express';
import { errorHandler, notFound } from './middleware/errors.js';
import { requireGraph } from './middleware/ready.js';
import { healthRouter } from './routes/health.js';
import { servicesRouter } from './routes/services.js';
import { stopsRouter } from './routes/stops.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({
      name: 'api-bus',
      description: 'Singapore bus stops, services and live arrivals.',
      endpoints: [
        'GET /health',
        'GET /stops?near=lat,lon&radius=500',
        'GET /stops?q=lavender',
        'GET /stops?offset=0&limit=50',
        'GET /stops/:stopId',
        'GET /stops/:stopId/arrivals?service=141',
        'GET /services?q=&servingStop=',
        'GET /services/:serviceNo',
        'GET /services/:serviceNo/stops',
        'GET /services/:serviceNo/between?from=&to=',
      ],
      upstream: {
        arrivals: 'https://arrivelah2.busrouter.sg',
        graph: 'https://data.busrouter.sg',
      },
    });
  });

  app.use(healthRouter);

  // Everything below needs stop and service data in memory.
  app.use(requireGraph);
  app.use(stopsRouter);
  app.use(servicesRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

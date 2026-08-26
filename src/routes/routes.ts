import { Router } from 'express';
import { findRoute, findStop, routes } from '../data/network.js';
import { HttpError } from '../middleware/errors.js';

export const routesRouter: Router = Router();

/** GET /routes — every route, optionally filtered by ?servingStop=S1 */
routesRouter.get('/routes', (req, res) => {
  const servingStop = req.query['servingStop'];

  if (servingStop === undefined) {
    res.json({ routes });
    return;
  }

  if (typeof servingStop !== 'string') {
    throw new HttpError(400, 'servingStop must be a single stop id');
  }
  if (!findStop(servingStop)) {
    throw new HttpError(404, `Unknown stop "${servingStop}"`);
  }

  res.json({
    routes: routes.filter((route) =>
      route.stopIds.some((id) => id.toUpperCase() === servingStop.toUpperCase()),
    ),
  });
});

/** GET /routes/:routeId */
routesRouter.get('/routes/:routeId', (req, res) => {
  const route = findRoute(req.params.routeId);
  if (!route) throw new HttpError(404, `Unknown route "${req.params.routeId}"`);
  res.json(route);
});

/** GET /routes/:routeId/stops — the route's stops, in travel order. */
routesRouter.get('/routes/:routeId/stops', (req, res) => {
  const route = findRoute(req.params.routeId);
  if (!route) throw new HttpError(404, `Unknown route "${req.params.routeId}"`);

  const stops = route.stopIds.map((id) => findStop(id)).filter((stop) => stop !== undefined);
  res.json({ routeId: route.id, stops });
});

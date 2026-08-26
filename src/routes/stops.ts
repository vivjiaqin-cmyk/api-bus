import { Router } from 'express';
import { arrivalsAt } from '../data/arrivals.js';
import {
  countStops,
  findStop,
  pageStops,
  searchStops,
  servicesServing,
  stopsNear,
} from '../data/graph.js';
import { HttpError } from '../middleware/errors.js';
import { coordinatePair, intParam, optionalString } from '../query.js';

export const stopsRouter: Router = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_RADIUS_M = 500;
const MAX_RADIUS_M = 5000;

/**
 * GET /stops
 *   ?near=lat,lon&radius=500   stops around a point, nearest first
 *   ?q=lavender                free-text over id, name and road
 *   ?offset=0&limit=50         otherwise, a page of the whole list
 *
 * Singapore has over 5,000 stops, so this never returns all of them at once.
 */
stopsRouter.get('/stops', (req, res) => {
  const limit = intParam(req.query['limit'], 'limit', DEFAULT_LIMIT, 1, MAX_LIMIT);
  const near = optionalString(req.query['near'], 'near');
  const q = optionalString(req.query['q'], 'q');

  if (near !== undefined && q !== undefined) {
    throw new HttpError(400, 'Use either near or q, not both');
  }

  if (near !== undefined) {
    const { lat, lon } = coordinatePair(near, 'near');
    const radius = intParam(req.query['radius'], 'radius', DEFAULT_RADIUS_M, 1, MAX_RADIUS_M);
    const stops = stopsNear(lat, lon, radius, limit);
    res.json({ total: countStops(), count: stops.length, radiusMetres: radius, stops });
    return;
  }

  if (q !== undefined) {
    const stops = searchStops(q, limit);
    res.json({ total: countStops(), count: stops.length, query: q, stops });
    return;
  }

  const offset = intParam(req.query['offset'], 'offset', 0, 0, 1_000_000);
  const stops = pageStops(offset, limit);
  res.json({ total: countStops(), count: stops.length, offset, stops });
});

/** GET /stops/:stopId */
stopsRouter.get('/stops/:stopId', (req, res) => {
  const stop = findStop(req.params.stopId);
  if (!stop) throw new HttpError(404, `Unknown stop "${req.params.stopId}"`);

  res.json({ ...stop, services: servicesServing(stop.id) });
});

/**
 * GET /stops/:stopId/arrivals?service=141
 *
 * Live predictions. Times move between calls; that is the point.
 */
stopsRouter.get('/stops/:stopId/arrivals', (req, res, next) => {
  const stop = findStop(req.params.stopId);
  if (!stop) throw new HttpError(404, `Unknown stop "${req.params.stopId}"`);

  const service = optionalString(req.query['service'], 'service');

  arrivalsAt(stop.id)
    .then((all) => {
      const arrivals = service
        ? all.filter((a) => a.service.toUpperCase() === service.toUpperCase())
        : all;

      if (service && arrivals.length === 0 && !servicesServing(stop.id).includes(service)) {
        throw new HttpError(404, `Service "${service}" does not call at stop ${stop.id}`);
      }

      res.json({
        stop: { id: stop.id, name: stop.name, road: stop.road },
        fetchedAt: new Date().toISOString(),
        count: arrivals.length,
        arrivals,
      });
    })
    .catch(next);
});

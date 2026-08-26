import { Router } from 'express';
import { findStop, routesServing, stops } from '../data/network.js';
import { HttpError } from '../middleware/errors.js';
import type { Arrival } from '../types.js';

export const stopsRouter: Router = Router();

const MAX_ARRIVALS = 10;

/**
 * Predict the next departures at a stop.
 *
 * The seed network has no live vehicle feed, so arrivals are derived from each
 * route's headway: buses are assumed to run on an even cadence from the top of
 * the hour. Replace this with the real AVL feed when one is available.
 */
function predictArrivals(stopId: string, limit: number): Arrival[] {
  const now = new Date();
  const minutesIntoHour = now.getMinutes() + now.getSeconds() / 60;

  const arrivals = routesServing(stopId).flatMap((route) => {
    const sinceLast = minutesIntoHour % route.headwayMinutes;
    const first = route.headwayMinutes - sinceLast;

    return Array.from({ length: limit }, (_unused, i) => {
      const minutesAway = first + i * route.headwayMinutes;
      return {
        routeId: route.id,
        routeShortName: route.shortName,
        stopId,
        arrivesAt: new Date(now.getTime() + minutesAway * 60_000).toISOString(),
        minutesAway: Math.round(minutesAway),
      } satisfies Arrival;
    });
  });

  return arrivals.sort((a, b) => a.minutesAway - b.minutesAway).slice(0, limit);
}

/** GET /stops — every stop. */
stopsRouter.get('/stops', (_req, res) => {
  res.json({ stops });
});

/** GET /stops/:stopId */
stopsRouter.get('/stops/:stopId', (req, res) => {
  const stop = findStop(req.params.stopId);
  if (!stop) throw new HttpError(404, `Unknown stop "${req.params.stopId}"`);

  res.json({ ...stop, routes: routesServing(stop.id).map((route) => route.id) });
});

/** GET /stops/:stopId/arrivals?limit=5 */
stopsRouter.get('/stops/:stopId/arrivals', (req, res) => {
  const stop = findStop(req.params.stopId);
  if (!stop) throw new HttpError(404, `Unknown stop "${req.params.stopId}"`);

  const raw = req.query['limit'];
  let limit = 5;
  if (raw !== undefined) {
    if (typeof raw !== 'string') throw new HttpError(400, 'limit must be a single value');
    limit = Number(raw);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ARRIVALS) {
      throw new HttpError(400, `limit must be an integer between 1 and ${MAX_ARRIVALS}`);
    }
  }

  res.json({ stopId: stop.id, arrivals: predictArrivals(stop.id, limit) });
});

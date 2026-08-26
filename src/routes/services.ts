import { Router } from 'express';
import {
  allServices,
  compareServiceNumbers,
  countServices,
  findService,
  findStop,
  hopsBetween,
  servicesServing,
  stopsOfService,
} from '../data/graph.js';
import { HttpError } from '../middleware/errors.js';
import { intParam, optionalString } from '../query.js';

export const servicesRouter: Router = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

/**
 * A bus *service* (the number on the front) runs one or more *routes* (the
 * ordered stop lists, usually one per direction). The seed version of this API
 * called the whole thing a "route", which does not survive contact with the real
 * data, so these live under /services.
 */

/** Summary form: the full stop lists are large, so they are not inlined here. */
function summarise(no: string, name: string, routes: string[][]) {
  return {
    no,
    name,
    directions: routes.length,
    stopCounts: routes.map((r) => r.length),
  };
}

/**
 * GET /services
 *   ?q=14                  match on number or name
 *   ?servingStop=07361     only services calling at that stop
 */
servicesRouter.get('/services', (req, res) => {
  const limit = intParam(req.query['limit'], 'limit', DEFAULT_LIMIT, 1, MAX_LIMIT);
  const q = optionalString(req.query['q'], 'q');
  const servingStop = optionalString(req.query['servingStop'], 'servingStop');

  let list = allServices();

  if (servingStop !== undefined) {
    const stop = findStop(servingStop);
    if (!stop) throw new HttpError(404, `Unknown stop "${servingStop}"`);
    const allowed = new Set(servicesServing(stop.id));
    list = list.filter((s) => allowed.has(s.no));
  }

  if (q !== undefined) {
    const needle = q.toLowerCase();
    list = list.filter((s) => `${s.no} ${s.name}`.toLowerCase().includes(needle));
  }

  list.sort((a, b) => compareServiceNumbers(a.no, b.no));
  const page = list.slice(0, limit);

  res.json({
    total: countServices(),
    matched: list.length,
    count: page.length,
    services: page.map((s) => summarise(s.no, s.name, s.routes)),
  });
});

/** GET /services/:serviceNo */
servicesRouter.get('/services/:serviceNo', (req, res) => {
  const service = findService(req.params.serviceNo);
  if (!service) throw new HttpError(404, `Unknown service "${req.params.serviceNo}"`);
  res.json(summarise(service.no, service.name, service.routes));
});

/** GET /services/:serviceNo/stops — full stop lists, in travel order per direction. */
servicesRouter.get('/services/:serviceNo/stops', (req, res) => {
  const service = findService(req.params.serviceNo);
  if (!service) throw new HttpError(404, `Unknown service "${req.params.serviceNo}"`);

  const directions = stopsOfService(service.no) ?? [];
  res.json({
    no: service.no,
    name: service.name,
    directions: directions.map((stops, i) => ({
      direction: i + 1,
      count: stops.length,
      stops,
    })),
  });
});

/**
 * GET /services/:serviceNo/between?from=07361&to=50031
 *
 * How many stops apart two points are on this service, and whether it runs that
 * way at all — the ordering question the raw route arrays make awkward.
 */
servicesRouter.get('/services/:serviceNo/between', (req, res) => {
  const service = findService(req.params.serviceNo);
  if (!service) throw new HttpError(404, `Unknown service "${req.params.serviceNo}"`);

  const fromId = optionalString(req.query['from'], 'from');
  const toId = optionalString(req.query['to'], 'to');
  if (fromId === undefined || toId === undefined) {
    throw new HttpError(400, 'from and to are both required');
  }

  const from = findStop(fromId);
  if (!from) throw new HttpError(404, `Unknown stop "${fromId}"`);
  const to = findStop(toId);
  if (!to) throw new HttpError(404, `Unknown stop "${toId}"`);

  const hops = hopsBetween(service.no, from.id, to.id);
  res.json({
    service: service.no,
    from: { id: from.id, name: from.name },
    to: { id: to.id, name: to.name },
    travels: hops !== undefined,
    hops: hops ?? null,
  });
});

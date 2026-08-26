import type { Route, Stop } from '../types.js';

/**
 * A small in-memory network. Swap this module for a database layer when the
 * shape of the API settles — everything above it only reads through the
 * lookup helpers below.
 */

export const stops: Stop[] = [
  { id: 'S1', name: 'Central Station', lat: 1.3006, lon: 103.8559 },
  { id: 'S2', name: 'Riverside Market', lat: 1.2966, lon: 103.8503 },
  { id: 'S3', name: 'University Gate', lat: 1.2966, lon: 103.7764 },
  { id: 'S4', name: 'Harbour Terminal', lat: 1.2644, lon: 103.8223 },
  { id: 'S5', name: 'Northpoint Depot', lat: 1.4294, lon: 103.8350 },
];

export const routes: Route[] = [
  {
    id: 'R10',
    shortName: '10',
    longName: 'Central — Harbour via Riverside',
    stopIds: ['S1', 'S2', 'S4'],
    headwayMinutes: 8,
  },
  {
    id: 'R22',
    shortName: '22',
    longName: 'Central — University express',
    stopIds: ['S1', 'S3'],
    headwayMinutes: 15,
  },
  {
    id: 'R47',
    shortName: '47',
    longName: 'Northpoint loop',
    stopIds: ['S5', 'S1', 'S2', 'S5'],
    headwayMinutes: 20,
  },
];

export function findStop(id: string): Stop | undefined {
  return stops.find((stop) => stop.id.toUpperCase() === id.toUpperCase());
}

export function findRoute(id: string): Route | undefined {
  return routes.find((route) => route.id.toUpperCase() === id.toUpperCase());
}

/** Routes that call at a given stop, in no particular order. */
export function routesServing(stopId: string): Route[] {
  return routes.filter((route) =>
    route.stopIds.some((id) => id.toUpperCase() === stopId.toUpperCase()),
  );
}

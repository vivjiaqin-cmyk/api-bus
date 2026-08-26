import { config } from '../config.js';
import type { Service, Stop, StopWithDistance } from '../types.js';

/**
 * The stop and route graph, loaded from data.busrouter.sg and held in memory.
 *
 * This replaces the hand-written seed network the service started with. Nothing
 * above this module talks to the upstream files directly; handlers go through the
 * lookup helpers below, so swapping the source (LTA DataMall, a database, a
 * snapshot on disk) means changing this file alone.
 */

/** Raw upstream shape: { stopId: [lon, lat, name, road] }. */
type RawStops = Record<string, [number, number, string, string]>;
/** Raw upstream shape: { serviceNo: { name, routes: [[stopId, ...]] } }. */
type RawServices = Record<string, { name: string; routes: string[][] }>;

let stops = new Map<string, Stop>();
let services = new Map<string, Service>();
/** stopId -> service numbers calling there. */
let servicesByStop = new Map<string, Set<string>>();
let stopArray: Stop[] = [];
let loadedAt: Date | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

export interface GraphStatus {
  ready: boolean;
  loadedAt: string | null;
  stops: number;
  services: number;
}

export function graphStatus(): GraphStatus {
  return {
    ready: loadedAt !== null,
    loadedAt: loadedAt?.toISOString() ?? null,
    stops: stops.size,
    services: services.size,
  };
}

export function isReady(): boolean {
  return loadedAt !== null;
}

async function fetchJson<T>(file: string): Promise<T> {
  const url = new URL(file, config.graphBaseUrl).toString();
  const res = await fetch(url, {
    signal: AbortSignal.timeout(config.upstreamTimeoutMs),
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return (await res.json()) as T;
}

function build(rawStops: RawStops, rawServices: RawServices): void {
  const nextStops = new Map<string, Stop>();
  for (const [id, entry] of Object.entries(rawStops)) {
    const [lon, lat, name, road] = entry;
    nextStops.set(id, { id, name, road, lat, lon });
  }

  const nextServices = new Map<string, Service>();
  const nextByStop = new Map<string, Set<string>>();
  for (const [no, entry] of Object.entries(rawServices)) {
    const routes = entry.routes ?? [];
    nextServices.set(no, { no, name: entry.name, routes });
    for (const route of routes) {
      for (const stopId of route) {
        let set = nextByStop.get(stopId);
        if (!set) {
          set = new Set();
          nextByStop.set(stopId, set);
        }
        set.add(no);
      }
    }
  }

  // Swap in together so a request never sees stops from one load and services
  // from another.
  stops = nextStops;
  services = nextServices;
  servicesByStop = nextByStop;
  stopArray = [...nextStops.values()];
  loadedAt = new Date();
}

export async function loadGraph(): Promise<void> {
  const [rawStops, rawServices] = await Promise.all([
    fetchJson<RawStops>('stops.min.json'),
    fetchJson<RawServices>('services.min.json'),
  ]);
  build(rawStops, rawServices);
}

/**
 * Load once, then keep trying with backoff. Resolves on the first success; a
 * later refresh that fails leaves the previous graph in place rather than
 * emptying it, because stale stop positions beat no stop positions.
 */
export async function startGraph(): Promise<void> {
  let attempt = 0;
  for (;;) {
    try {
      await loadGraph();
      break;
    } catch (err) {
      attempt += 1;
      const waitMs = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
      console.error(
        `route graph load failed (attempt ${attempt}): ${(err as Error).message}; retrying in ${waitMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  console.log(
    `route graph ready: ${stops.size} stops, ${services.size} services`,
  );

  refreshTimer = setInterval(() => {
    loadGraph()
      .then(() => console.log(`route graph refreshed: ${stops.size} stops`))
      .catch((err: unknown) =>
        console.error(`route graph refresh failed, keeping previous copy: ${(err as Error).message}`),
      );
  }, config.graphRefreshMs);
  // Do not hold the process open for a background refresh.
  refreshTimer.unref();
}

export function stopGraph(): void {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

/* ------------------------------------------------------------------ lookups */

export function findStop(id: string): Stop | undefined {
  return stops.get(id) ?? stops.get(id.toUpperCase());
}

export function findService(no: string): Service | undefined {
  return services.get(no) ?? services.get(no.toUpperCase());
}

export function countStops(): number {
  return stops.size;
}

export function countServices(): number {
  return services.size;
}

export function allServices(): Service[] {
  return [...services.values()];
}

export function servicesServing(stopId: string): string[] {
  const set = servicesByStop.get(stopId);
  return set ? [...set].sort(compareServiceNumbers) : [];
}

/** Stops of one service, in travel order, per direction. */
export function stopsOfService(no: string): Stop[][] | undefined {
  const service = findService(no);
  if (!service) return undefined;
  return service.routes.map((route) =>
    route.map((id) => findStop(id)).filter((s): s is Stop => s !== undefined),
  );
}

/** Metres between two coordinates, on a sphere. */
export function metresBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function stopsNear(
  lat: number,
  lon: number,
  radiusMetres: number,
  limit: number,
): StopWithDistance[] {
  const out: StopWithDistance[] = [];
  for (const stop of stopArray) {
    const metresAway = metresBetween(lat, lon, stop.lat, stop.lon);
    if (metresAway <= radiusMetres) out.push({ ...stop, metresAway: Math.round(metresAway) });
  }
  out.sort((a, b) => a.metresAway - b.metresAway);
  return out.slice(0, limit);
}

export function searchStops(query: string, limit: number): Stop[] {
  const q = query.trim().toLowerCase();
  const out: Stop[] = [];
  for (const stop of stopArray) {
    if (`${stop.id} ${stop.name} ${stop.road}`.toLowerCase().includes(q)) {
      out.push(stop);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function pageStops(offset: number, limit: number): Stop[] {
  return stopArray.slice(offset, offset + limit);
}

/**
 * Stops travelled from `from` to `to` on one service, or undefined if it never
 * runs that way. Checks every direction and returns the shortest.
 */
export function hopsBetween(no: string, from: string, to: string): number | undefined {
  const service = findService(no);
  if (!service) return undefined;

  let best: number | undefined;
  for (const route of service.routes) {
    const start = route.indexOf(from);
    if (start < 0) continue;
    const end = route.indexOf(to, start + 1);
    if (end < 0) continue;
    const hops = end - start;
    if (best === undefined || hops < best) best = hops;
  }
  return best;
}

/** "10" before "100", "NR1" after numerics — how a timetable would order them. */
export function compareServiceNumbers(a: string, b: string): number {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  const aNum = Number.isNaN(na);
  const bNum = Number.isNaN(nb);
  if (aNum && bNum) return a.localeCompare(b);
  if (aNum) return 1;
  if (bNum) return -1;
  if (na !== nb) return na - nb;
  return a.localeCompare(b);
}

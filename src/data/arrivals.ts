import { config } from '../config.js';
import { HttpError } from '../middleware/errors.js';
import type { Arrival, BusType, Load } from '../types.js';

/**
 * Live arrival predictions from arrivelah2, which fronts LTA's bus arrival feed.
 *
 * Responses are cached for `arrivalsTtlMs` and concurrent requests for the same
 * stop share one upstream call, so a burst of clients asking about the same stop
 * costs exactly one request. arrivelah2 is a free, unfunded service; do not
 * remove the cache.
 */

/** Raw upstream shape for a single predicted run. */
interface RawRun {
  time: string;
  duration_ms: number;
  lat: number;
  lng: number;
  load: string;
  feature: string;
  type: string;
  monitored: number;
}

interface RawService {
  no: string;
  operator: string;
  next?: RawRun | null;
  next2?: RawRun | null;
  next3?: RawRun | null;
}

interface RawResponse {
  services?: RawService[];
}

const LOADS: Record<string, Load> = {
  SEA: 'seats',
  SDA: 'standing',
  LSD: 'limited-standing',
};

const TYPES: Record<string, BusType> = {
  SD: 'single',
  DD: 'double',
  BD: 'bendy',
};

interface Entry {
  at: number;
  value: Promise<Arrival[]>;
}

const cache = new Map<string, Entry>();

function toArrival(service: RawService, run: RawRun): Arrival {
  const arrival: Arrival = {
    service: service.no,
    operator: service.operator,
    arrivesAt: run.time,
    minutesAway: Math.max(0, Math.round((new Date(run.time).getTime() - Date.now()) / 60000)),
    load: LOADS[run.load] ?? 'unknown',
    busType: TYPES[run.type] ?? 'unknown',
    wheelchairAccessible: run.feature === 'WAB',
    liveTracked: run.monitored === 1,
  };

  // A stationary 0,0 means the feed has no fix on the vehicle, not the Gulf of Guinea.
  if (run.monitored === 1 && (run.lat !== 0 || run.lng !== 0)) {
    arrival.position = { lat: run.lat, lon: run.lng };
  }
  return arrival;
}

async function fetchUpstream(stopId: string): Promise<Arrival[]> {
  const url = new URL(config.arrivalsUrl);
  url.searchParams.set('id', stopId);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(config.upstreamTimeoutMs) });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    throw new HttpError(
      timedOut ? 504 : 502,
      timedOut
        ? `Arrival feed did not respond within ${config.upstreamTimeoutMs}ms`
        : `Arrival feed unreachable: ${(err as Error).message}`,
    );
  }

  if (!res.ok) {
    throw new HttpError(502, `Arrival feed returned ${res.status} for stop ${stopId}`);
  }

  const body = (await res.json()) as RawResponse;
  const out: Arrival[] = [];
  for (const service of body.services ?? []) {
    for (const key of ['next', 'next2', 'next3'] as const) {
      const run = service[key];
      if (run?.time) out.push(toArrival(service, run));
    }
  }

  out.sort((a, b) => a.arrivesAt.localeCompare(b.arrivesAt));
  return out;
}

export function arrivalsAt(stopId: string): Promise<Arrival[]> {
  const hit = cache.get(stopId);
  if (hit && Date.now() - hit.at < config.arrivalsTtlMs) return hit.value;

  const value = fetchUpstream(stopId).catch((err: unknown) => {
    // Never cache a failure: the next caller should get a fresh attempt.
    cache.delete(stopId);
    throw err;
  });

  cache.set(stopId, { at: Date.now(), value });
  return value;
}

/** Test seam, and a way to force a refresh. */
export function clearArrivalCache(): void {
  cache.clear();
}

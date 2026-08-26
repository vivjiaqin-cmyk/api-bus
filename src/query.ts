import { HttpError } from './middleware/errors.js';

/**
 * Express gives `string | string[] | ParsedQs | undefined` for every query value.
 * These narrow it to what a handler actually wants, rejecting the rest with a 400
 * that says which parameter was wrong rather than failing deeper in.
 */

export function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new HttpError(400, `${name} must be a single value`);
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function intParam(
  value: unknown,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = optionalString(value, name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

/** Parses "lat,lon" and rejects anything outside real coordinate ranges. */
export function coordinatePair(value: unknown, name: string): { lat: number; lon: number } {
  const raw = optionalString(value, name);
  if (raw === undefined) throw new HttpError(400, `${name} is required`);

  const parts = raw.split(',');
  if (parts.length !== 2) throw new HttpError(400, `${name} must be "lat,lon"`);

  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new HttpError(400, `${name} latitude must be between -90 and 90`);
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new HttpError(400, `${name} longitude must be between -180 and 180`);
  }
  return { lat, lon };
}

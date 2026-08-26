export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Route {
  id: string;
  shortName: string;
  longName: string;
  /** Stop ids in travel order. */
  stopIds: string[];
  /** Minutes between departures during the service day. */
  headwayMinutes: number;
}

export interface Arrival {
  routeId: string;
  routeShortName: string;
  stopId: string;
  /** ISO 8601 timestamp of the predicted arrival. */
  arrivesAt: string;
  minutesAway: number;
}

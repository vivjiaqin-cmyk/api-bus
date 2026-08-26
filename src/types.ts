export interface Stop {
  /** LTA bus stop code, e.g. "07361". */
  id: string;
  name: string;
  /** The road the stop sits on. */
  road: string;
  lat: number;
  lon: number;
}

/** A stop plus how far it is from a point the caller asked about. */
export interface StopWithDistance extends Stop {
  metresAway: number;
}

export interface Service {
  /** Service number as printed on the bus, e.g. "141". */
  no: string;
  /** Descriptive name, e.g. "Lor 1 Geylang Ter <=> Toa Payoh Int". */
  name: string;
  /** Stop ids in travel order, one array per direction. */
  routes: string[][];
}

/** How full the bus is when it reaches the stop. */
export type Load = 'seats' | 'standing' | 'limited-standing' | 'unknown';

/** Bus body type: single deck, double deck, bendy. */
export type BusType = 'single' | 'double' | 'bendy' | 'unknown';

export interface Arrival {
  service: string;
  operator: string;
  /** ISO 8601 timestamp of the predicted arrival. */
  arrivesAt: string;
  minutesAway: number;
  load: Load;
  busType: BusType;
  wheelchairAccessible: boolean;
  /**
   * False when the prediction comes from the timetable rather than a tracked
   * vehicle — treat those times as much softer.
   */
  liveTracked: boolean;
  /** Last known position of the vehicle, absent when it is not being tracked. */
  position?: { lat: number; lon: number };
}

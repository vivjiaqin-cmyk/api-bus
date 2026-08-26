# api-bus

A small REST API for bus routes, stops, and arrival predictions. Node + Express 5 +
TypeScript, no database — the network lives in memory so the service runs with nothing
but `npm install`.

## Running it

```bash
npm install
npm run dev          # tsx watch, reloads on save
```

Then visit <http://localhost:3000>. For a production-style run:

```bash
npm run build        # tsc -> dist/
npm start
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Watch mode via `tsx` |
| `npm run build` | Compile `src/` to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | `tsc --noEmit` |

Configuration is read from the environment; see `.env.example`. `PORT` defaults to `3000`.

## Endpoints

| Method | Path | Returns |
|--------|------|---------|
| GET | `/` | Service name and endpoint index |
| GET | `/health` | `{ status, uptimeSeconds }` |
| GET | `/routes` | All routes. `?servingStop=S2` filters to routes calling at a stop |
| GET | `/routes/:routeId` | One route |
| GET | `/routes/:routeId/stops` | The route's stops, in travel order |
| GET | `/stops` | All stops |
| GET | `/stops/:stopId` | One stop, plus the route ids serving it |
| GET | `/stops/:stopId/arrivals` | Next departures. `?limit=` is 1–10, default 5 |

Ids are matched case-insensitively. Errors come back as `{ "error": "..." }` with a 400
for bad input and a 404 for an unknown id or path.

```bash
curl localhost:3000/stops/S1/arrivals?limit=3
```

```json
{
  "stopId": "S1",
  "arrivals": [
    {
      "routeId": "R22",
      "routeShortName": "22",
      "stopId": "S1",
      "arrivesAt": "2026-08-26T05:30:00.770Z",
      "minutesAway": 6
    }
  ]
}
```

## How arrivals are predicted

There is no live vehicle feed behind this. Each route carries a `headwayMinutes`, and
arrivals are projected from an even cadence off the top of the hour — good enough to
develop a client against, and the single place to swap in a real AVL feed later. The logic
is `predictArrivals` in `src/routes/stops.ts`.

## Layout

```
src/
  index.ts             server bootstrap and graceful shutdown
  app.ts               builds the Express app
  config.ts            environment parsing, validated at startup
  types.ts             Stop, Route, Arrival
  data/network.ts      the seed network + lookup helpers
  middleware/errors.ts HttpError, 404 handler, error handler
  routes/              health, routes, stops
```

`data/network.ts` is the seam. Everything above it reads through `findStop`, `findRoute`,
and `routesServing`, so replacing it with a database layer does not touch the handlers.

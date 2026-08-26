# api-bus

A REST API for Singapore bus stops, services and **live arrivals**. Node + Express 5 +
TypeScript, zero runtime dependencies beyond Express.

There is no database. The stop and service graph — 5,207 stops and 605 services — is
downloaded at startup and held in memory; arrival predictions are fetched live and cached
for 15 seconds.

## Running it

```bash
npm install
npm run dev          # tsx watch, reloads on save
```

Then visit <http://localhost:3000>. For a production-style run:

```bash
npm run build
npm start
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Watch mode via `tsx` |
| `npm run build` | Compile `src/` to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | `tsc --noEmit` |

## Data sources

| Upstream | Provides |
|---|---|
| [data.busrouter.sg](https://data.busrouter.sg) | Stops and route graph, refreshed daily |
| [arrivelah2](https://arrivelah2.busrouter.sg) | Live arrivals, crowding, bus type, wheelchair access |

Neither needs an API key. Both are free and unfunded — the caching here exists to keep load
off them, so please do not remove it.

## Endpoints

| Method | Path | Returns |
|--------|------|---------|
| GET | `/` | Endpoint index |
| GET | `/health` | Status and route-graph readiness |
| GET | `/stops?near=lat,lon&radius=500` | Stops around a point, nearest first |
| GET | `/stops?q=lavender` | Free-text search over id, name and road |
| GET | `/stops?offset=0&limit=50` | A page of all stops |
| GET | `/stops/:stopId` | One stop, plus the services calling there |
| GET | `/stops/:stopId/arrivals?service=141` | **Live** predictions |
| GET | `/services?q=&servingStop=` | Services, filterable |
| GET | `/services/:serviceNo` | One service |
| GET | `/services/:serviceNo/stops` | Full stop lists, in travel order per direction |
| GET | `/services/:serviceNo/between?from=&to=` | Whether it runs that way, and how many stops |

`limit` defaults to 50 and caps at 200 for stops; `radius` is in metres, up to 5,000. Ids
are matched case-insensitively. Errors are `{ "error": "..." }` with 400 for bad input, 404
for an unknown id, 502/504 when the arrival feed is unreachable, and 503 while the graph is
still loading.

### Live arrivals

```bash
curl "localhost:3000/stops/07361/arrivals?service=141"
```

```json
{
  "stop": { "id": "07361", "name": "Bef Kallang Bahru", "road": "Lavender St" },
  "fetchedAt": "2026-08-26T06:00:16.533Z",
  "count": 2,
  "arrivals": [
    {
      "service": "141",
      "operator": "SBST",
      "arrivesAt": "2026-08-26T14:13:33+08:00",
      "minutesAway": 13,
      "load": "seats",
      "busType": "single",
      "wheelchairAccessible": true,
      "liveTracked": false
    }
  ]
}
```

`liveTracked: false` means the time comes from the timetable rather than a tracked vehicle
— treat it as much softer. When a bus *is* tracked, its last known `position` is included.

## Configuration

All optional; see `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `GRAPH_BASE_URL` | data.busrouter.sg | Where the stop/route graph comes from |
| `ARRIVALS_URL` | arrivelah2 | Where live arrivals come from |
| `ARRIVALS_TTL_MS` | `15000` | Arrival cache; matches upstream `max-age=15` |
| `GRAPH_REFRESH_MS` | 24h | How often to re-download the graph |
| `UPSTREAM_TIMEOUT_MS` | `8000` | Timeout for both upstreams |

## Behaviour under failure

- The server **listens before the graph loads**, so `/health` answers immediately with
  `ready: false` and a 503 rather than looking dead. Data endpoints return 503 until the
  graph is in memory.
- A failed graph download retries with exponential backoff, capped at 30s. A failed
  *refresh* keeps the previous copy — stale stop positions beat none.
- Arrival-feed failures return 502 (unreachable) or 504 (timeout) and are **never cached**,
  so the next request retries.

## Layout

```
src/
  index.ts             bootstrap, graceful shutdown
  app.ts               builds the Express app
  config.ts            environment parsing, validated at startup
  query.ts             query-parameter narrowing with 400s
  types.ts             Stop, Service, Arrival
  data/graph.ts        the stop/service graph and every lookup
  data/arrivals.ts     arrivelah2 client, cache, in-flight dedup
  middleware/          errors, readiness gate
  routes/              health, stops, services
```

`data/graph.ts` is the seam. Handlers never touch upstream directly, so pointing this at
LTA DataMall or a database means changing that one file.

## History

This started as a toy with five hardcoded stops and arrival times invented from a fixed
headway. Those are gone. One naming change came with the real data: a bus **service** (the
number on the front) runs one or more **routes** (ordered stop lists, usually one per
direction), so the old `/routes` endpoints are now `/services`.

# API performance and PostgreSQL pool tuning

The Express API uses a single process-wide `pg.Pool`. Pool configuration is
centralised in `server/db/pool-config.js` and applied by `server/index.js`.

## Defaults

| Variable | Default | Allowed range | Purpose |
|---|---:|---:|---|
| `PG_POOL_MAX` | 10 | 1–30 | Maximum concurrent PostgreSQL clients per API instance |
| `PG_IDLE_TIMEOUT_MS` | 30000 | 1000–120000 | Close idle clients after this duration |
| `PG_CONNECT_TIMEOUT_MS` | 5000 | 1000–30000 | Bound connection acquisition time |
| `PG_POOL_MAX_USES` | 7500 | 100–1000000 | Recycle clients after this many queries |

TCP keepalive is enabled with a 10-second initial delay. Invalid values fall
back to safe defaults; out-of-range integers are clamped.

## Deployment guidance

- Set `PG_POOL_MAX` based on the database's connection limit and the maximum
  number of simultaneously running API instances. The combined pool capacity
  is approximately `PG_POOL_MAX × instance count`; reserve connections for
  migrations, administration and other services.
- For a small pooled/serverless PostgreSQL plan, start with `PG_POOL_MAX=3` or
  `5` and measure queueing before increasing it.
- Do not increase pool size to mask slow SQL. Use query plans and measured
  latency first; add indexes through reviewed migrations, not ad-hoc production
  DDL.
- A shorter idle timeout reduces idle connections but can increase reconnect
  work. Tune only after observing connection churn.
- No database URL, password or other secret is logged by the pool configuration.

## Validation

`test/postgres-pool-config.test.js` covers defaults, deployment overrides,
invalid values and boundary clamping. CI runs it through the existing root
`npm test` glob and the API package test command.

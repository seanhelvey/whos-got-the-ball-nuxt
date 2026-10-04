# Who's Got the Ball (Nuxt)

**Live:** https://whos-got-the-ball-nuxt.onrender.com

A Nuxt 3 + Vue + TypeScript port of
[whos-got-the-ball](https://github.com/seanhelvey/whos-got-the-ball), which is
Flask, Strawberry GraphQL and React. It is a true port. The GraphQL schema, the
three tables, the seed data and the screens are the same, and nothing behaves
differently.

The app tracks who owns the next action on a clean energy contract. Work moves
between your own team, the customer, the utility, the installer, the financier
and the permitting office. Whoever holds the ball owes the next step, and when it
sits too long the deal stalls.

![The original React app](docs/original.png)

*The original React app. The Vue port renders the same board.*

## Run it

Needs Node 22.13 or newer, for the built in `node:sqlite`.

```bash
npm install
npm run dev        # http://localhost:3000
```

The UI, the API and the GraphiQL explorer share one port. GraphQL lives at
`/graphql`, the same path as the original. The SQLite file is created and seeded
on first boot at `.data/ball.db`. Delete it to reset to the sample data. Set
`DATABASE_PATH` to put it somewhere else.

## Test it

```bash
npm test           # Vitest, a port of the original test_api.py
npm run typecheck
```

The tests build the API against a throwaway database and read top to bottom as a
tour of every query and both mutations.

## Deploy it

`render.yaml` is a Render Blueprint for one Node web service. In Render, choose
New, then Blueprint, and point it at this repo. It builds with `npm run build`
and starts `node .output/server/index.mjs`. The database sits on the instance's
ephemeral disk, so each deploy boots onto a freshly seeded board, as the
original's container did.

## What each piece is

```
server/lib/models.ts   constants, row types, and the overdue / stalled / done rules (models.py)
server/lib/db.ts       SQLite tables, queries, passBall and updateStatus (models.py + schema.py)
server/lib/seed.ts     the same fictional seed data (seed.py)
server/lib/schema.ts   the GraphQL SDL and resolvers on graphql-yoga (schema.py)
server/routes/graphql.ts  mounts the API at /graphql (app.py)
server/plugins/db.ts   creates and seeds the database on boot (app.py)
tests/api.test.ts      the API tour (test_api.py)
render.yaml            Render Blueprint (Dockerfile)
```

## What changed from the original, and why

The contract is identical. Running both apps side by side, the full board query
returns the same JSON and introspection returns the same schema, type names
`ContractType`, `StakeholderType` and `HandoffType` included. What differs is
underneath.

| Original | Port | Why |
| --- | --- | --- |
| Strawberry types from Python hints | SDL string plus resolvers on graphql-yoga | Yoga is the common Node server and the SDL is copied verbatim from what Strawberry printed |
| SQLAlchemy models | Plain SQL on `node:sqlite` | No ORM needed for three tables, and no native module to compile on Render |
| Flask plus gunicorn in Docker | Nitro, the server inside Nuxt | One process serves pages and API, as before |
| `DATABASE_URL`, Postgres optional | `DATABASE_PATH`, SQLite only | The brief was SQLite. The Postgres path was never exercised in the original |
| Timestamps with microseconds | Timestamps with milliseconds, padded | JavaScript dates stop at milliseconds |

Kept on purpose, quirks included: resolvers still build the whole object graph,
so the N+1 queries the original's README calls out are still here. Statuses and
kinds are still plain strings. There is still no authentication, and GraphiQL is
still public.

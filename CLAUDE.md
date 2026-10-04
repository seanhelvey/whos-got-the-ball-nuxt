# Working in this repo

A Nuxt 3 port of [whos-got-the-ball](https://github.com/seanhelvey/whos-got-the-ball).
It is a true port: same GraphQL schema, same tables, same seed data, same screens.
If the original does something, this does the same thing, quirks included.

## Reviewing a pull request

- **Review the changed code only.** Comment on lines the diff touches. Leave
  untouched files alone, even when they could be better.
- **No broad refactors.** Do not suggest renaming, restructuring, or swapping
  libraries across the codebase. A fix should fit inside the change under review.
- **Ranked findings.** Number them, most severe first: bugs, then behavior that
  drifts from the original, then missing tests, then style. Give each one a
  file and line, what goes wrong, and the smallest fix. Say so plainly when
  there is nothing worth raising.
- **Parity is a bug class.** A difference from the original in the schema, the
  tables, the seed data, or what a screen shows is a finding.

## Commands

```bash
npm run dev        # localhost:3000, API and GraphiQL at /graphql
npm test           # Vitest
npm run typecheck  # vue-tsc
npm run review 12  # review PR 12 with your local Claude, posted as a PR comment
npm run build && node .output/server/index.mjs   # what Render runs
```

## Conventions

- **Domain rules live in `server/lib/models.ts`.** `isOverdue`, `isStalled`,
  `isDone` and `daysWaiting` are computed there and reach the client as flags.
  A threshold in a `.vue` file belongs in `models.ts` instead.
- **The board's counts and its filter are one predicate.** `ATTENTION` is what
  both the tile numbers and the visible list run through.
- **No Apollo, no CSS framework, no state library.** A plain `fetch` client,
  one stylesheet, `ref` and `computed`.
- **Tests read top to bottom as a tour of the GraphQL API.**
- **Comments explain why, not what.**
- Never commit the SQLite file. It is generated on boot.

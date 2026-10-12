# movie-ratings

## Persistence repair — 20261012ac

The shipped `78c8e38f4bea` build skipped saved localStorage reads when its write probe failed at quota. It also replaced whole score rankings with only the rendered cards after dragging or animated swapping. Both are covered by regression tests using the real `live-state.json` data.

Startup now reads local records regardless of write availability, waits for IndexedDB recovery, archives original raw records, and selects the newest structurally complete candidate. Newer partial records retain their valid fields, with missing fields supplied by a complete record. Unrecoverable records stop startup and writes; the read-only recovery page exports localStorage and IndexedDB records, including raw malformed records.

Each IndexedDB write commits current and previous snapshots in one transaction. A save is reported successful only after localStorage read-back or an IndexedDB commit. Quota failures are retried on future edits and do not clear any local backup. Existing ranked films outside a filter retain their slots and relative order when visible films are reordered. Storage events cannot replace newer in-memory edits with older or malformed records.

`recovery-ranks-20261011.json` records 726 unique ranked IDs from commit `a6cf8d26381930bb3f98dcb38d393e2a64d92498` (2026-10-11 23:25 JST). Rank arrays and exact scores match `3345e5148698156c0011d0ddb99a358508c0966c` (2026-10-12 19:48 JST) exactly. Recovery inserts only missing IDs that still exist and retain the recorded score. Existing local sequences, changed scores, additions, notes, reviews, viewing history, genres and deleted films take precedence. No remote movie data is rewritten by this release.

Run `PLAYWRIGHT_MODULE=<path-to-playwright> node scripts/test-persistence.cjs` with Chrome installed, or set `CHROME_PATH`. Tests reproduce the old quota failure and verify normal/quota-full/IndexedDB-only saves, both stores failing, malformed newer snapshots, missing-rank recovery, reviews and viewing history, filtered ordering, page reopen, and browser process restart. Tests use an isolated origin and profiles beside the checkout, never the user's Pages origin.

The existing `movie-drag-touch` and `movie-search-drag` browser suites also pass against this release: lifted card drag, animated arrow swap, and search-to-ranking touch handoff with anchored release. These are mobile Chromium tests. Actual iPhone Safari and installed Home Screen app lifecycle tests remain unverified.

# movie-ratings — person filmographies 20261013b

The verified ranking source is `016f78b559f54f56078654abc927a016b71a6962` (2026-10-10 23:31 JST): 721 ranked films. The Oct11 reference used by release `20261012ac` contained damaged ranks; `recovery-ranks-20261011.json` is now a deprecation stub and must never be used as a ranking source.

The first large loss in saved rank membership is between `4285d8a` and `5ef2d5f`: 721 -> 160 IDs while exact scores are identical (2026-10-11 01:12 -> 01:42 JST). Saved data does not identify the specific gesture or filter. The confirmed bugs were rendered-only rank replacement and skipping localStorage reads after a quota-failed write probe; both are regression-tested.

The published live state restores the Oct10 721 ranks, clears the numeric scores/ranks of five later Utada works while preserving their stars, and preserves all eight added films and metadata. Sin City is restored to 82 by explicit user instruction. Automatic one-time repair accepts only verified historical damaged sequences or missing membership; unknown subsequent ordering is retained and listed in `state.rankRecovery.conflicts`. Offline installations retain their state until the recovery reference can be fetched. Importing the corrected JSON is an explicit recovery option.

Persistence reads localStorage even when writing is unavailable, validates integrity seals on committed snapshots, protects richer records from newer truncated records, and merges partial metadata without replacing ranks. Every save rejects loss of previously ranked films whose scores are unchanged. IndexedDB commits current/previous atomically; failed writes never remove backups. Success requires localStorage read-back or an IndexedDB transaction commit. Failure of both stores shows a persistent warning and current JSON download button. Successful IndexedDB fallback does not show a quota warning.

Migration archives use fixed per-source keys, so restarts no longer add full snapshots. Existing older archives are retained. Current/previous snapshots and the latest before-import snapshot are bounded in number. Undo stores per-film changes rather than duplicating all custom films, with 50 changes / approximately 500 KB of UTF-16 payload. Old undo data is archived before migration when IndexedDB is available. Reviews and viewing history are not trimmed. Poster data is remote URL/path metadata (about 73 KB), with no image blobs/base64 in state and no app service-worker poster cache. Current data necessarily grows with actual user content; no browser can promise unlimited storage.

JSON restore validates structure/integrity, asks for explicit confirmation, archives current state before mutation, preserves additions and latest metadata/reviews/watch history, and reports success only after a successful save. Automatic episode score backfill from old backups is disabled. GitHub HTTP409 conflicts stop synchronization instead of retrying with a new SHA and overwriting concurrent edits.

Run with Chrome installed and `PLAYWRIGHT_MODULE` set to a Playwright package path:

- `node scripts/test-persistence.cjs`: real quota exhaustion, normal/fallback/both-failed saving, page reopen and Chrome process restart; reviews/history/ranks after restart.
- `node scripts/test-recovery.cjs`: damaged real data ->721 verified ranks, five unscored, metadata retained, bounded startup records, JSON restore and invalid import, incomplete newer candidates, checksum damage, destructive rank-save rejection.
- `node scripts/test-filtered-ui.cjs`: actual genre filter and animated arrow operation, hidden membership/order and reload.
- Existing `movie-drag-touch` and `movie-search-drag` workflow suites: physical CDP touch, lifted card, animated swap and search-to-full-ranking anchored handoff.

Tests use isolated origins/profiles, never the user's browser data. Mobile Chromium emulation is not actual Safari. iPhone Safari reload/task kill and installed Home Screen app lifecycle remain unverified on physical hardware. Browser data deletion, OS eviction and a device shutdown before save completion still require external JSON/GitHub backups.

## Person filmographies (20261013b)

Tap cast/director names in film details, or a person autocomplete entry, to open the in-app person view. Registered works open first, ordered by the existing numeric score and rankOrder slots (unscored works last). Switching to all works defaults to TMDB popularity. Movie/TV, participation role and sort controls are available. A green viewed badge uses viewing history/dates or existing stars/numeric scores; registration alone is unviewed.

TMDB person IDs identify cast and online candidates. Names without IDs resolve using source-work credits where available, then search; ambiguous results require selection. Film/TV IDs are namespaced; individual episodes do not mark an entire series as viewed. Movie/TV participation is taken from TMDB combined credits (cast, Director and Creator jobs). All works means TMDB's catalog, not a guarantee of complete filmographies.

Unregistered works open a read-only detail preview. The explicit registration action adds an unviewed/unscored movie or TV series through the existing addFilm/save path and retains every previous score/rank. Failed saving provides a JSON backup button within the person overlay. No poster blobs or new metadata are added to saved movie data merely by browsing. The person cache is session-only, bounded to 20 people, separate from movie persistence. Offline/API errors keep the locally known person works available.

- `node scripts/test-people.cjs`: real current movie state, isolated mobile/desktop Chrome, deterministic TMDB responses; cast/director/local+online autocomplete entry points, exact tie ordering, typed film/TV IDs, role/type/sort controls, viewed badges, read-only previews, explicit unscored movie+TV registration/reload, ambiguous names, missing API key, browser Back, both-store failure with unchanged existing snapshots, and generated JSON Blob/download initiation. Managed Chrome cancels even a minimal Blob OS download; actual file download completion is not asserted.
- `node scripts/test-filtered-ui.cjs`: rerun successfully for filtered animated rank swaps and hidden ranks after reload.

These new tests use simulated TMDB responses and Chromium mobile emulation. Live TMDB credentials/network behavior and physical iPhone Safari/Home Screen operation have not been tested.

# Requested: unify Attack on Titan finale entries

User request (2026-10-22): Letterboxd has split the finale into three records; unify the front/back specials into the existing single finale work.

This is an additional requirement for the next update, not a completed data migration.

- Keep canonical `custom-1790508959663-6kld` — 劇場版「進撃の巨人」完結編 THE LAST ATTACK (TMDb 1333100).
- Consolidate `custom-1790508958909-q6d6` — Special 1 (TMDb 1200954) and `custom-1790508959270-dbu3` — Special 2 (TMDb 1201102).
- Leave TV series `custom-1791966534875-2yiz` (TMDb TV 1429) independent.
- The checked local live-state snapshot gives all three finale works 87 points, consecutive ranked positions (canonical first). Keep canonical score and its position relative to all unrelated works; do not recalculate or average ratings. This snapshot is not proof of the latest browser or remote state.
- Preserve all source records and per-work reviews/watch history in a recovery archive before consolidation. Preserve distinct reviews with their original work attribution rather than overwrite one with another.
- Prevent Letterboxd RSS/CSV sync from recreating the two separate entries; maintain source identities for matching without importing one source's rating/review over another's.
- Verify current data before applying. Divergent current scores or manually edited source data must not be silently discarded.
- Verify repeat sync and reload retain one finale entry, preserve unrelated scores/order, and keep the TV series separate.

The request authorizes this specific consolidation. It does not grant general merge/publication permission. Include implementation and verification in the scheduled work after the overall plan review; do not consume the reserved quota with an additional large work session now.

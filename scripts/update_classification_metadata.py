"""Fetch public classification metadata only; never edit a user's movie state."""
import json
from datetime import datetime, timezone
from pathlib import Path
from recheck_cast import collect, resolve, api

ROOT = Path(__file__).resolve().parents[1]


def profile(f, kind, tmdb_id, details, parent=None):
    data = parent or details
    return {
        "schema": 2, "source": "tmdb", "checkedAt": datetime.now(timezone.utc).isoformat(),
        "kind": "movie" if kind == "movie" else "tv", "tmdbId": tmdb_id,
        "scope": "series" if kind in ("episode", "season") else kind,
        "filmTitles": list(dict.fromkeys(str(f[k]) for k in ("title", "originalTitle", "englishTitle", "lbTitle") if f.get(k))),
        "filmYear": f.get("year") or "",
        "companies": [{"id": c["id"], "name": c["name"], "country": c.get("origin_country", "")} for c in data.get("production_companies", []) if c.get("id") and c.get("name")],
        "productionCountries": [{"code": c["iso_3166_1"], "name": c.get("name", "")} for c in data.get("production_countries", []) if c.get("iso_3166_1")],
        "originalLanguage": data.get("original_language") or "",
        "spokenLanguages": [{"code": l["iso_639_1"], "name": l.get("english_name") or l.get("name", "")} for l in data.get("spoken_languages", []) if l.get("iso_639_1")],
        "genres": [{"id": g["id"], "name": g.get("name", "")} for g in data.get("genres", []) if g.get("id")],
        "formatHint": "animation" if any(g.get("id") == 16 for g in data.get("genres", [])) else "",
        "releaseDate": details.get("release_date") or details.get("air_date") or details.get("first_air_date") or "",
        "runtime": details.get("runtime"),
    }


def main():
    target = ROOT / "tmdb-metadata.json"
    catalog = json.loads(target.read_text(encoding="utf-8-sig"))
    rows = catalog.setdefault("films", {})
    films = collect()
    counts = {"total": len(films), "fetched": 0, "cached": 0, "unmatched": 0, "error": 0}
    problems = []
    for index, (film_id, f) in enumerate(films.items(), 1):
        old = rows.get(film_id) or {}
        cached = old.get("classification131") or {}
        if cached.get("schema") == 2 and str(cached.get("filmYear") or "") == str(f.get("year") or "") and f.get("title") in cached.get("filmTitles", []):
            counts["cached"] += 1
            continue
        try:
            # A previous candidate title must never validate its own possibly wrong ID.
            safe = {k: v for k, v in old.items() if k not in ("title", "titleAliases")}
            kind, tmdb_id, details, season, episode = resolve(f, safe)
            parent = api(f"/tv/{tmdb_id}", language="en-US") if kind in ("episode", "season") else None
            item = profile(f, kind, tmdb_id, details, parent)
            rows[film_id] = {**old, "classification131": item}
            counts["fetched"] += 1
        except (ValueError, RuntimeError) as exc:
            key = "unmatched" if isinstance(exc, ValueError) else "error"
            counts[key] += 1
            problems.append({"id": film_id, "title": f.get("title"), "status": key, "reason": str(exc)})
            if "authentication" in str(exc).lower():
                print("TMDB authentication failed; no further requests attempted.", flush=True)
                break
        if index % 20 == 0 or index == len(films):
            print(f"Classified {index}/{len(films)}: {counts}", flush=True)
            target.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    target.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {"at": datetime.now(timezone.utc).isoformat(), "counts": counts, "problems": problems}
    (ROOT / "classification-fetch-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(counts), flush=True)


if __name__ == "__main__":
    main()
